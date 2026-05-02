const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'data', 'studygraph.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        subject TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        source_type TEXT DEFAULT 'text',
        source_ref TEXT DEFAULT '',
        created_date TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        relation TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY(from_id) REFERENCES entries(id),
        FOREIGN KEY(to_id) REFERENCES entries(id)
      );
      CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(created_date);
      CREATE INDEX IF NOT EXISTS idx_entries_subject ON entries(subject);
      CREATE INDEX IF NOT EXISTS idx_conn_from ON connections(from_id);
      CREATE INDEX IF NOT EXISTS idx_conn_to ON connections(to_id);
    `);
  }
  return db;
}

function addEntry({ title, content, subject = '', tags = [], source_type = 'text', source_ref = '' }) {
  const d = getDb();
  const id = uuidv4();
  const now = new Date();
  const created_date = now.toISOString().slice(0, 10);
  const created_at = now.toISOString();
  d.prepare('INSERT INTO entries (id, title, content, subject, tags, source_type, source_ref, created_date, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, title, content, subject, JSON.stringify(tags), source_type, source_ref, created_date, created_at);
  return { id, title, content, subject, tags, source_type, source_ref, created_date, created_at };
}

function addConnection(fromId, toId, relation = '') {
  const d = getDb();
  const id = uuidv4();
  d.prepare('INSERT INTO connections (id, from_id, to_id, relation, created_at) VALUES (?,?,?,?,?)')
    .run(id, fromId, toId, relation, new Date().toISOString());
  return { id, from_id: fromId, to_id: toId, relation };
}

function getAllEntries() {
  return getDb().prepare('SELECT * FROM entries ORDER BY created_at DESC').all()
    .map(e => ({ ...e, tags: JSON.parse(e.tags) }));
}

function getAllConnections() {
  return getDb().prepare('SELECT * FROM connections').all();
}

function getEntry(id) {
  const e = getDb().prepare('SELECT * FROM entries WHERE id = ?').get(id);
  return e ? { ...e, tags: JSON.parse(e.tags) } : null;
}

function searchEntries(query) {
  return getDb().prepare("SELECT * FROM entries WHERE title LIKE ? OR content LIKE ? ORDER BY created_at DESC")
    .all(`%${query}%`, `%${query}%`)
    .map(e => ({ ...e, tags: JSON.parse(e.tags) }));
}

function deleteEntry(id) {
  const d = getDb();
  d.prepare('DELETE FROM connections WHERE from_id = ? OR to_id = ?').run(id, id);
  d.prepare('DELETE FROM entries WHERE id = ?').run(id);
}

function updateEntry(id, { title, content, subject, tags }) {
  const d = getDb();
  d.prepare('UPDATE entries SET title = ?, content = ?, subject = ?, tags = ? WHERE id = ?')
    .run(title, content, subject, JSON.stringify(tags), id);
  return getEntry(id);
}

module.exports = { addEntry, addConnection, getAllEntries, getAllConnections, getEntry, searchEntries, deleteEntry, updateEntry };
