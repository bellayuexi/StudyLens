const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const storage = require('../core/storage');
const llm = require('../core/llm-provider');
const extractor = require('../core/extractor');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 20 * 1024 * 1024 } });

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
    const { question, history } = req.body;
    if (!question) return res.status(400).json({ error: 'question is required' });
    const allEntries = storage.getAllEntries();
    const searchText = [question, ...(history || []).map(h => h.question)].join(' ');
    const keywords = [];
    for (let len = 4; len >= 2; len--) {
      for (let i = 0; i <= searchText.length - len; i++) {
        const w = searchText.slice(i, i + len);
        if (/^[一-鿿]+$/.test(w)) keywords.push(w);
      }
    }
    const uniqueKw = [...new Set(keywords)];
    const relevant = allEntries.filter(e => {
      const text = e.title + e.content + (e.tags || []).join(' ') + e.subject;
      return uniqueKw.some(kw => text.includes(kw));
    }).slice(0, 20);
    const result = await llm.askQuestion(question, relevant.length > 0 ? relevant : allEntries.slice(0, 10), history || []);
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

// Ingest from file upload (PDF, Word, Excel, txt)
app.post('/api/ingest/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const origName = req.file.originalname;
    const ext = path.extname(origName).toLowerCase();
    const dest = req.file.path + ext;
    fs.renameSync(req.file.path, dest);

    const text = await extractor.extractFromFile(dest);
    fs.unlinkSync(dest);

    const subject = req.body.subject || '';
    const knowledgePoints = await llm.analyze(text.slice(0, 10000), subject);
    const existingEntries = storage.getAllEntries();
    const created = [];

    for (const kp of knowledgePoints) {
      const entry = storage.addEntry({
        title: kp.title, content: kp.content,
        subject: kp.subject || subject || '', tags: kp.tags || [],
        source_type: ext.replace('.', ''), source_ref: origName,
      });
      created.push(entry);
      try {
        const connections = await llm.findConnections(entry, existingEntries);
        for (const conn of connections) {
          if (existingEntries.some(e => e.id === conn.id)) storage.addConnection(entry.id, conn.id, conn.relation);
        }
      } catch (_) {}
      existingEntries.push(entry);
    }
    res.json({ created, extractedLength: text.length });
  } catch (err) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

// Ingest from URL
app.post('/api/ingest/url', async (req, res) => {
  try {
    const { url, subject } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    const text = await extractor.extractFromUrl(url);
    const knowledgePoints = await llm.analyze(text.slice(0, 10000), subject || '');
    const existingEntries = storage.getAllEntries();
    const created = [];

    for (const kp of knowledgePoints) {
      const entry = storage.addEntry({
        title: kp.title, content: kp.content,
        subject: kp.subject || subject || '', tags: kp.tags || [],
        source_type: 'url', source_ref: url,
      });
      created.push(entry);
      try {
        const connections = await llm.findConnections(entry, existingEntries);
        for (const conn of connections) {
          if (existingEntries.some(e => e.id === conn.id)) storage.addConnection(entry.id, conn.id, conn.relation);
        }
      } catch (_) {}
      existingEntries.push(entry);
    }
    res.json({ created, extractedLength: text.length });
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
