const express = require('express');
const cors = require('cors');
const storage = require('../core/storage');
const llm = require('../core/llm-provider');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Get all entries + connections for graph
app.get('/api/graph', (req, res) => {
  const entries = storage.getAllEntries();
  const connections = storage.getAllConnections();
  res.json({ entries, connections });
});

// Get all entries
app.get('/api/entries', (req, res) => {
  const { q } = req.query;
  const entries = q ? storage.searchEntries(q) : storage.getAllEntries();
  res.json(entries);
});

// Get single entry
app.get('/api/entries/:id', (req, res) => {
  const entry = storage.getEntry(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  res.json(entry);
});

// Ingest text → LLM analyze → store entries + auto-connect
app.post('/api/ingest', async (req, res) => {
  try {
    const { text, subject, source_type = 'text', source_ref = '' } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const knowledgePoints = await llm.analyze(text, subject);
    const existingEntries = storage.getAllEntries();
    const created = [];

    for (const kp of knowledgePoints) {
      const entry = storage.addEntry({
        title: kp.title,
        content: kp.content,
        subject: kp.subject || subject || '',
        tags: kp.tags || [],
        source_type,
        source_ref,
      });
      created.push(entry);

      // Auto-connect to existing knowledge
      try {
        const connections = await llm.findConnections(entry, existingEntries);
        for (const conn of connections) {
          if (existingEntries.some(e => e.id === conn.id)) {
            storage.addConnection(entry.id, conn.id, conn.relation);
          }
        }
      } catch (_) { /* connection finding is best-effort */ }

      existingEntries.push(entry);
    }

    res.json({ created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add manual connection
app.post('/api/connections', (req, res) => {
  const { from_id, to_id, relation = '' } = req.body;
  if (!from_id || !to_id) return res.status(400).json({ error: 'from_id and to_id required' });
  const conn = storage.addConnection(from_id, to_id, relation);
  res.json(conn);
});

// Q&A: ask a question with existing knowledge as context
app.post('/api/qa', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'question is required' });
    const allEntries = storage.getAllEntries();
    const q = question.toLowerCase();
    const relevant = allEntries.filter(e =>
      e.tags.some(t => q.includes(t.toLowerCase())) ||
      q.split(/\s+/).some(w => w.length > 1 && (e.title.includes(w) || e.content.includes(w)))
    ).slice(0, 15);
    const result = await llm.askQuestion(question, relevant.length > 0 ? relevant : allEntries.slice(0, 10));
    res.json({ ...result, relatedEntries: relevant.map(e => ({ id: e.id, title: e.title, subject: e.subject })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Q&A: save suggested cards
app.post('/api/qa/save', async (req, res) => {
  try {
    const { question, cards } = req.body;
    if (!cards?.length) return res.status(400).json({ error: 'cards required' });
    const existingEntries = storage.getAllEntries();
    const created = [];
    for (const card of cards) {
      const entry = storage.addEntry({
        title: card.title,
        content: card.content,
        subject: card.subject || '',
        tags: card.tags || [],
        source_type: 'qa',
        source_ref: question || '',
      });
      created.push(entry);
      try {
        const connections = await llm.findConnections(entry, existingEntries);
        for (const conn of connections) {
          if (existingEntries.some(e => e.id === conn.id)) {
            storage.addConnection(entry.id, conn.id, conn.relation);
          }
        }
      } catch (_) {}
      existingEntries.push(entry);
    }
    res.json({ created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update entry
app.put('/api/entries/:id', (req, res) => {
  const { title, content, subject, tags } = req.body;
  const entry = storage.updateEntry(req.params.id, { title, content, subject, tags });
  if (!entry) return res.status(404).json({ error: 'Not found' });
  res.json(entry);
});

// Delete entry
app.delete('/api/entries/:id', (req, res) => {
  storage.deleteEntry(req.params.id);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`StudyGraph server running on http://localhost:${PORT}`));
