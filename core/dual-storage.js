const sqliteStorage = require('./storage');
const wikiStorage = require('./wiki-storage');

function addRaw(text, sourceType, sourceRef) {
  return wikiStorage.addRaw(text, sourceType, sourceRef);
}

function addEntry(data) {
  const sqlEntry = sqliteStorage.addEntry(data);
  try {
    wikiStorage.addEntry({ ...data, id: sqlEntry.id, created_date: sqlEntry.created_date, created_at: sqlEntry.created_at });
  } catch (err) {
    console.error('[wiki] addEntry failed:', err.message);
  }
  return sqlEntry;
}

function addConnection(fromId, toId, relation = '') {
  const conn = sqliteStorage.addConnection(fromId, toId, relation);
  try {
    wikiStorage.addConnection(fromId, toId, relation);
  } catch (err) {
    console.error('[wiki] addConnection failed:', err.message);
  }
  return conn;
}

function getAllEntries() {
  return sqliteStorage.getAllEntries();
}

function getAllConnections() {
  return sqliteStorage.getAllConnections();
}

function getEntry(id) {
  return sqliteStorage.getEntry(id);
}

function searchEntries(query) {
  return sqliteStorage.searchEntries(query);
}

function deleteEntry(id) {
  sqliteStorage.deleteEntry(id);
  try { wikiStorage.deleteEntry(id); } catch (err) {
    console.error('[wiki] deleteEntry failed:', err.message);
  }
}

function updateEntry(id, data) {
  const entry = sqliteStorage.updateEntry(id, data);
  try { wikiStorage.updateEntry(id, data); } catch (err) {
    console.error('[wiki] updateEntry failed:', err.message);
  }
  return entry;
}

module.exports = { addRaw, addEntry, addConnection, getAllEntries, getAllConnections, getEntry, searchEntries, deleteEntry, updateEntry };
