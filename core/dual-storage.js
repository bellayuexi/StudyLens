const sqliteStorage = require('./storage');
const wikiStorage = require('./wiki-storage');

function getReader(backend) {
  return backend === 'sqlite' ? sqliteStorage : wikiStorage;
}

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

function getAllEntries(backend = 'wiki') {
  return getReader(backend).getAllEntries();
}

function getAllConnections(backend = 'wiki') {
  return getReader(backend).getAllConnections();
}

function getEntry(id, backend = 'wiki') {
  return getReader(backend).getEntry(id);
}

function searchEntries(query, backend = 'wiki') {
  return getReader(backend).searchEntries(query);
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

function saveTopicPage(entryId, html, qaHistory, comments) {
  return wikiStorage.saveTopicPage(entryId, html, qaHistory, comments);
}

function getTopicPages(entryId) {
  return wikiStorage.getTopicPages(entryId);
}

function getLatestTopicPage(entryId) {
  return wikiStorage.getLatestTopicPage(entryId);
}

function updateTopicPageComments(pageId, comments) {
  return wikiStorage.updateTopicPageComments(pageId, comments);
}

function updateTopicPageQaHistory(pageId, qaHistory) {
  return wikiStorage.updateTopicPageQaHistory(pageId, qaHistory);
}

module.exports = { addRaw, addEntry, addConnection, getAllEntries, getAllConnections, getEntry, searchEntries, deleteEntry, updateEntry, saveTopicPage, getTopicPages, getLatestTopicPage, updateTopicPageComments, updateTopicPageQaHistory };
