const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const WIKI_ROOT = process.env.STUDYLENS_WIKI_DIR || path.join(__dirname, '..', 'wiki');
const RAW_DIR = path.join(WIKI_ROOT, 'raw');
const DRILL_CORE = path.join(WIKI_ROOT, 'drill', 'core');
const DRILL_EXT = path.join(WIKI_ROOT, 'drill', 'extended');
const INDEX_DIR = path.join(WIKI_ROOT, 'index');
const TAGS_DIR = path.join(INDEX_DIR, 'tags');
const TOPICS_DIR = path.join(WIKI_ROOT, 'topics');
const QA_DIR = path.join(WIKI_ROOT, 'qa');

function ensureDirs() {
  for (const d of [RAW_DIR, DRILL_CORE, DRILL_EXT, INDEX_DIR, TAGS_DIR, TOPICS_DIR, QA_DIR]) {
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
parent_id: ${entry.parent_id || ''}
sort_order: ${entry.sort_order !== undefined ? entry.sort_order : ''}
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
    parent_id: meta.parent_id || '',
    created_date: meta.created_date || '',
    created_at: meta.created_at || '',
    sort_order: meta.sort_order !== undefined ? parseInt(meta.sort_order, 10) : undefined,
    _file: filePath,
  };
}

function getDrillDir(sourceType) {
  return sourceType === 'qa' ? DRILL_EXT : DRILL_CORE;
}

function addEntry({ id: passedId, title, content, subject = '', tags = [], source_type = 'text', source_ref = '', parent_id = '' }) {
  const id = passedId || uuidv4();
  const now = new Date();
  const entry = {
    id, title, content, subject, tags, source_type, source_ref, parent_id,
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

function updateEntry(id, data) {
  const entry = getEntry(id);
  if (!entry) return null;
  const oldTags = entry.tags || [];
  const updated = { ...entry };
  if (data.title !== undefined) updated.title = data.title;
  if (data.content !== undefined) updated.content = data.content;
  if (data.subject !== undefined) updated.subject = data.subject;
  if (data.tags !== undefined) updated.tags = data.tags;
  if (data.sort_order !== undefined) updated.sort_order = data.sort_order;
  delete updated._file;
  if (entry._file && fs.existsSync(entry._file)) {
    fs.writeFileSync(entry._file, entryToMd(updated), 'utf-8');
  }
  const index = getEntryIndex();
  const idx = index.findIndex(e => e.id === id);
  if (idx >= 0) {
    if (data.title !== undefined) index[idx].title = data.title;
    if (data.subject !== undefined) index[idx].subject = data.subject;
  }
  saveEntryIndex(index);

  const newTags = updated.tags || [];
  const removedTags = oldTags.filter(t => !newTags.includes(t));
  const addedTags = newTags.filter(t => !oldTags.includes(t));
  if (removedTags.length > 0) removeFromTagIndex(id, removedTags);
  if (addedTags.length > 0) addToTagIndex(id, updated.title, updated.subject, addedTags);

  return updated;
}

// --- Topic pages ---

function getTopicDir(entryId) {
  const dir = path.join(TOPICS_DIR, entryId.slice(0, 8));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function saveTopicPage(entryId, html, qaHistory = [], comments = [], includedQaIds = []) {
  const dir = getTopicDir(entryId);
  const existing = getTopicPages(entryId);
  const version = existing.length > 0 ? existing[0].version + 1 : 1;
  const id = uuidv4();
  const now = new Date().toISOString();

  const meta = { id, entry_id: entryId, version, comments, qa_history: qaHistory, included_qa_ids: includedQaIds, created_at: now };
  const content = `---\n${JSON.stringify(meta, null, 2)}\n---\n\n${html}`;
  fs.writeFileSync(path.join(dir, `v${version}.md`), content, 'utf-8');

  return { id, entry_id: entryId, version, html, comments, qa_history: qaHistory, created_at: now };
}

function getTopicPages(entryId) {
  const dir = path.join(TOPICS_DIR, entryId.slice(0, 8));
  if (!fs.existsSync(dir)) return [];
  const pages = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().reverse()) {
    try {
      const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
      const match = raw.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
      if (!match) continue;
      const meta = JSON.parse(match[1]);
      if (meta.entry_id !== entryId) continue;
      pages.push({ ...meta, html: match[2] });
    } catch {}
  }
  return pages.sort((a, b) => b.version - a.version);
}

function getLatestTopicPage(entryId) {
  const pages = getTopicPages(entryId);
  return pages.length > 0 ? pages[0] : null;
}

function updateTopicPageField(pageId, field, value) {
  if (!fs.existsSync(TOPICS_DIR)) return;
  for (const dir of fs.readdirSync(TOPICS_DIR)) {
    const dirPath = path.join(TOPICS_DIR, dir);
    if (!fs.statSync(dirPath).isDirectory()) continue;
    for (const f of fs.readdirSync(dirPath).filter(f => f.endsWith('.md'))) {
      const filePath = path.join(dirPath, f);
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const match = raw.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
        if (!match) continue;
        const meta = JSON.parse(match[1]);
        if (meta.id === pageId) {
          meta[field] = value;
          fs.writeFileSync(filePath, `---\n${JSON.stringify(meta, null, 2)}\n---\n\n${match[2]}`, 'utf-8');
          return;
        }
      } catch {}
    }
  }
}

function updateTopicPageComments(pageId, comments) {
  updateTopicPageField(pageId, 'comments', comments);
}

function updateTopicPageQaHistory(pageId, qaHistory) {
  updateTopicPageField(pageId, 'qa_history', qaHistory);
}

function deleteTopicPageVersion(entryId, version) {
  const dir = path.join(TOPICS_DIR, entryId.slice(0, 8));
  const filePath = path.join(dir, `v${version}.md`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

function getTopicPageByVersion(entryId, version) {
  const pages = getTopicPages(entryId);
  return pages.find(p => p.version === version) || null;
}

function getTopicPageStatusMap() {
  if (!fs.existsSync(TOPICS_DIR)) return {};
  const result = {};
  for (const dir of fs.readdirSync(TOPICS_DIR)) {
    const dirPath = path.join(TOPICS_DIR, dir);
    if (!fs.statSync(dirPath).isDirectory()) continue;
    for (const f of fs.readdirSync(dirPath).filter(f => f.endsWith('.md')).sort().reverse()) {
      try {
        const raw = fs.readFileSync(path.join(dirPath, f), 'utf-8');
        const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
        if (!match) continue;
        const meta = JSON.parse(match[1]);
        const entryId = meta.entry_id;
        if (!entryId || result[entryId]) continue;
        const hasQa = Array.isArray(meta.qa_history) && meta.qa_history.some(q => q.answer);
        result[entryId] = { has_topic_page: true, has_qa: hasQa };
      } catch {}
    }
  }
  return result;
}

function getChildren(parentId) {
  return getAllEntries().filter(e => e.parent_id === parentId).sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
}

// --- Independent QA storage ---

function getEntryQA(entryId) {
  const file = path.join(QA_DIR, `${entryId}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    // Migration: seed from latest topic page if available
    const tp = getLatestTopicPage(entryId);
    if (tp?.page?.qa_history?.length) {
      const qa = tp.page.qa_history.filter(h => h.answer);
      if (qa.length) {
        saveEntryQA(entryId, qa);
        return qa;
      }
    }
    return [];
  }
}

function saveEntryQA(entryId, qaHistory) {
  fs.writeFileSync(path.join(QA_DIR, `${entryId}.json`), JSON.stringify(qaHistory, null, 2), 'utf-8');
}

module.exports = { addRaw, addEntry, addConnection, getAllEntries, getAllConnections, getEntry, searchEntries, deleteEntry, updateEntry, getTagIndex, rebuildTagIndex, WIKI_ROOT, saveTopicPage, getTopicPages, getLatestTopicPage, updateTopicPageComments, updateTopicPageQaHistory, getChildren, deleteTopicPageVersion, getTopicPageByVersion, getTopicPageStatusMap, getEntryQA, saveEntryQA };
