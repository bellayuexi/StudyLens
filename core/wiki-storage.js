const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const WIKI_ROOT = path.join(__dirname, '..', 'wiki');
const RAW_DIR = path.join(WIKI_ROOT, 'raw');
const DRILL_CORE = path.join(WIKI_ROOT, 'drill', 'core');
const DRILL_EXT = path.join(WIKI_ROOT, 'drill', 'extended');
const INDEX_DIR = path.join(WIKI_ROOT, 'index');
const TAGS_DIR = path.join(INDEX_DIR, 'tags');

function ensureDirs() {
  for (const d of [RAW_DIR, DRILL_CORE, DRILL_EXT, INDEX_DIR, TAGS_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}
ensureDirs();

function sanitize(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').slice(0, 60);
}

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return fallback; }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// --- Index management ---

function getConnections() {
  return readJson(path.join(INDEX_DIR, 'connections.json'), []);
}

function saveConnections(conns) {
  writeJson(path.join(INDEX_DIR, 'connections.json'), conns);
}

function getEntryIndex() {
  return readJson(path.join(INDEX_DIR, 'entries.json'), []);
}

function saveEntryIndex(entries) {
  writeJson(path.join(INDEX_DIR, 'entries.json'), entries);
}

// --- Tag index ---

function getTagIndex(tag) {
  return readJson(path.join(TAGS_DIR, `${sanitize(tag)}.json`), []);
}

function saveTagIndex(tag, entries) {
  writeJson(path.join(TAGS_DIR, `${sanitize(tag)}.json`), entries);
}

function addToTagIndex(entryId, title, subject, tags) {
  for (const tag of tags) {
    const idx = getTagIndex(tag);
    if (!idx.some(e => e.id === entryId)) {
      idx.push({ id: entryId, title, subject });
      saveTagIndex(tag, idx);
    }
  }
}

function removeFromTagIndex(entryId, tags) {
  for (const tag of tags) {
    const idx = getTagIndex(tag).filter(e => e.id !== entryId);
    saveTagIndex(tag, idx);
  }
}

function rebuildTagIndex() {
  const entries = getAllEntries();
  const tagMap = {};
  for (const e of entries) {
    for (const tag of (e.tags || [])) {
      if (!tagMap[tag]) tagMap[tag] = [];
      tagMap[tag].push({ id: e.id, title: e.title, subject: e.subject });
    }
  }
  // Clear old tag files
  if (fs.existsSync(TAGS_DIR)) {
    for (const f of fs.readdirSync(TAGS_DIR)) fs.unlinkSync(path.join(TAGS_DIR, f));
  }
  for (const [tag, entries] of Object.entries(tagMap)) {
    saveTagIndex(tag, entries);
  }
  return Object.keys(tagMap).length;
}

// --- Raw layer ---

function addRaw(text, sourceType, sourceRef) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `${ts}_${sanitize(sourceRef || sourceType)}`;
  const filePath = path.join(RAW_DIR, `${name}.md`);
  const frontmatter = `---
source_type: ${sourceType}
source_ref: ${sourceRef}
created_at: ${new Date().toISOString()}
---

`;
  fs.writeFileSync(filePath, frontmatter + text, 'utf-8');
  return filePath;
}

// --- Drill layer ---

function entryToMd(entry) {
  return `---
id: ${entry.id}
title: ${entry.title}
subject: ${entry.subject}
tags: ${JSON.stringify(entry.tags)}
source_type: ${entry.source_type}
source_ref: ${entry.source_ref}
created_date: ${entry.created_date}
created_at: ${entry.created_at}
---

${entry.content}
`;
}

function mdToEntry(content, filePath) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) return null;
  const meta = {};
  match[1].split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      meta[key] = val;
    }
  });
  let tags = [];
  try { tags = JSON.parse(meta.tags || '[]'); } catch {}
  return {
    id: meta.id,
    title: meta.title || '',
    content: match[2].trim(),
    subject: meta.subject || '',
    tags,
    source_type: meta.source_type || 'text',
    source_ref: meta.source_ref || '',
    created_date: meta.created_date || '',
    created_at: meta.created_at || '',
    _file: filePath,
  };
}

function getDrillDir(sourceType) {
  return sourceType === 'qa' ? DRILL_EXT : DRILL_CORE;
}

function addEntry({ title, content, subject = '', tags = [], source_type = 'text', source_ref = '' }) {
  const id = uuidv4();
  const now = new Date();
  const entry = {
    id, title, content, subject, tags, source_type, source_ref,
    created_date: now.toISOString().slice(0, 10),
    created_at: now.toISOString(),
  };

  const dir = getDrillDir(source_type);
  const subDir = path.join(dir, sanitize(subject || 'unsorted'));
  fs.mkdirSync(subDir, { recursive: true });
  const fileName = `${sanitize(title)}_${id.slice(0, 8)}.md`;
  fs.writeFileSync(path.join(subDir, fileName), entryToMd(entry), 'utf-8');

  const index = getEntryIndex();
  index.push({ id, title, subject, source_type, file: path.relative(WIKI_ROOT, path.join(subDir, fileName)) });
  saveEntryIndex(index);

  if (tags.length > 0) addToTagIndex(id, title, subject, tags);

  return entry;
}

function addConnection(fromId, toId, relation = '') {
  const id = uuidv4();
  const conns = getConnections();
  const conn = { id, from_id: fromId, to_id: toId, relation, created_at: new Date().toISOString() };
  conns.push(conn);
  saveConnections(conns);
  return conn;
}

function getAllEntries() {
  const entries = [];
  for (const base of [DRILL_CORE, DRILL_EXT]) {
    if (!fs.existsSync(base)) continue;
    const walk = (dir) => {
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        if (item.isDirectory()) walk(path.join(dir, item.name));
        else if (item.name.endsWith('.md')) {
          const content = fs.readFileSync(path.join(dir, item.name), 'utf-8');
          const entry = mdToEntry(content, path.join(dir, item.name));
          if (entry) entries.push(entry);
        }
      }
    };
    walk(base);
  }
  entries.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return entries;
}

function getAllConnections() {
  return getConnections();
}

function getEntry(id) {
  return getAllEntries().find(e => e.id === id) || null;
}

function searchEntries(query) {
  const q = query.toLowerCase();
  return getAllEntries().filter(e =>
    e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q)
  );
}

function deleteEntry(id) {
  const entry = getEntry(id);
  if (entry?.tags?.length > 0) removeFromTagIndex(id, entry.tags);
  if (entry?._file && fs.existsSync(entry._file)) fs.unlinkSync(entry._file);
  const index = getEntryIndex().filter(e => e.id !== id);
  saveEntryIndex(index);
  const conns = getConnections().filter(c => c.from_id !== id && c.to_id !== id);
  saveConnections(conns);
}

function updateEntry(id, { title, content, subject, tags }) {
  const entry = getEntry(id);
  if (!entry) return null;
  const oldTags = entry.tags || [];
  const updated = { ...entry, title, content, subject, tags };
  delete updated._file;
  if (entry._file && fs.existsSync(entry._file)) {
    fs.writeFileSync(entry._file, entryToMd(updated), 'utf-8');
  }
  const index = getEntryIndex();
  const idx = index.findIndex(e => e.id === id);
  if (idx >= 0) { index[idx].title = title; index[idx].subject = subject; }
  saveEntryIndex(index);

  const removedTags = oldTags.filter(t => !tags.includes(t));
  const addedTags = tags.filter(t => !oldTags.includes(t));
  if (removedTags.length > 0) removeFromTagIndex(id, removedTags);
  if (addedTags.length > 0) addToTagIndex(id, title, subject, addedTags);

  return updated;
}

module.exports = { addRaw, addEntry, addConnection, getAllEntries, getAllConnections, getEntry, searchEntries, deleteEntry, updateEntry, getTagIndex, rebuildTagIndex, WIKI_ROOT };
