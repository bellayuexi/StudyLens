const sqliteStorage = require('../core/storage');
const wikiStorage = require('../core/wiki-storage');

const entries = sqliteStorage.getAllEntries();
const connections = sqliteStorage.getAllConnections();

console.log(`Migrating ${entries.length} entries and ${connections.length} connections to Wiki...`);

for (const e of entries) {
  try {
    wikiStorage.addEntry({
      id: e.id, title: e.title, content: e.content,
      subject: e.subject, tags: e.tags,
      source_type: e.source_type, source_ref: e.source_ref,
      created_date: e.created_date, created_at: e.created_at,
    });
  } catch (err) {
    console.error(`  Entry "${e.title}": ${err.message}`);
  }
}

for (const c of connections) {
  try {
    wikiStorage.addConnection(c.from_id, c.to_id, c.relation);
  } catch (err) {
    console.error(`  Connection: ${err.message}`);
  }
}

console.log('Migration complete.');
console.log(`Wiki entries: ${wikiStorage.getAllEntries().length}`);
console.log(`Wiki connections: ${wikiStorage.getAllConnections().length}`);
