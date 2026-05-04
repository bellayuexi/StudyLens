const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const storage = require('../core/dual-storage');
const llm = require('../core/llm-provider');
const extractor = require('../core/extractor');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 20 * 1024 * 1024 } });

if (process.env.STUDYGRAPH_TEST_MODE) {
  app.post('/api/test/seed', (req, res) => {
    try {
      const entry = storage.addEntry(req.body);
      res.json(entry);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
}

// Get all entries + connections for graph
app.get('/api/graph', (req, res) => {
  const b = req.query.backend || 'wiki';
  const allEntries = storage.getAllEntries(b);
  const statusMap = storage.getTopicPageStatusMap();
  const entries = allEntries.filter(e => !e.parent_id).map(e => ({
    ...e,
    has_children: allEntries.some(c => c.parent_id === e.id),
    has_topic_page: !!(statusMap[e.id]?.has_topic_page),
    has_qa: !!(statusMap[e.id]?.has_qa),
  }));
  const connections = storage.getAllConnections(b);
  res.json({ entries, connections, backend: b });
});

// Get all entries
app.get('/api/entries', (req, res) => {
  const b = req.query.backend || 'wiki';
  const { q } = req.query;
  const entries = q ? storage.searchEntries(q, b) : storage.getAllEntries(b);
  res.json(entries);
});

// Get single entry
app.get('/api/entries/:id', (req, res) => {
  const b = req.query.backend || 'wiki';
  const entry = storage.getEntry(req.params.id, b);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  res.json(entry);
});

// Ingest text → LLM analyze → store entries + auto-connect
app.post('/api/ingest', async (req, res) => {
  try {
    const { text, subject, source_type = 'text', source_ref = '' } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    storage.addRaw(text, source_type, source_ref);
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

    storage.addRaw(text, ext.replace('.', ''), origName);
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
    storage.addRaw(text, 'url', url);
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
  const { title, content, subject, tags, sort_order } = req.body;
  const entry = storage.updateEntry(req.params.id, { title, content, subject, tags, sort_order });
  if (!entry) return res.status(404).json({ error: 'Not found' });
  res.json(entry);
});

// Delete entry
app.delete('/api/entries/:id', (req, res) => {
  storage.deleteEntry(req.params.id);
  res.json({ ok: true });
});

// Restructure: user instructs how to reorganize knowledge graph
app.post('/api/restructure', async (req, res) => {
  try {
    const { instruction, subject } = req.body;
    if (!instruction) return res.status(400).json({ error: 'instruction is required' });
    let entries = storage.getAllEntries();
    if (subject) entries = entries.filter(e => e.subject === subject || e.subject?.startsWith(subject));
    const changes = await llm.restructure(instruction, entries);
    const applied = [];
    for (const change of changes) {
      if (change.action === 'update' && change.id) {
        const existing = storage.getEntry(change.id);
        if (existing) {
          const updated = storage.updateEntry(change.id, {
            title: change.title || existing.title,
            content: existing.content,
            subject: change.subject || existing.subject,
            tags: change.tags || existing.tags,
          });
          if (updated) applied.push({ action: 'update', id: change.id, title: updated.title, subject: updated.subject });
        }
      } else if (change.action === 'merge' && change.ids?.length > 1) {
        const mergedEntry = storage.addEntry({
          title: change.merged_title,
          content: change.merged_content,
          subject: change.subject || '',
          tags: change.tags || [],
          source_type: 'merge',
          source_ref: change.ids.join(','),
        });
        for (const id of change.ids) storage.deleteEntry(id);
        applied.push({ action: 'merge', ids: change.ids, newId: mergedEntry.id, title: mergedEntry.title });
      }
    }
    res.json({ changes: applied, total: applied.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// QA mind map: generate mind map structure from QA result
app.post('/api/qa/mindmap', async (req, res) => {
  try {
    const { question, answer, cards, relatedEntries } = req.body;
    console.log('[mindmap] received question:', question?.slice(0, 50), 'answer:', answer?.slice(0, 50));
    if (!question) return res.status(400).json({ error: 'question is required' });
    const mindmap = await llm.buildQAMindMap(question, answer || '', cards || [], relatedEntries || []);
    console.log('[mindmap] type:', mindmap?.type, 'title:', mindmap?.title);
    if (!mindmap || !mindmap.type || !['comparison', 'timeline', 'tree'].includes(mindmap.type)) {
      console.warn('[mindmap] Invalid response, returning fallback tree');
      return res.json({ type: 'tree', title: question.slice(0, 20), branches: [] });
    }
    res.json(mindmap);
  } catch (err) {
    console.error('[mindmap] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Generate smart questions for an entry
app.post('/api/entries/:id/questions', async (req, res) => {
  try {
    const entry = storage.getEntry(req.params.id);
    if (!entry) return res.status(404).json({ error: 'entry not found' });
    const topicPage = storage.getLatestTopicPage(req.params.id);
    const existingQa = (topicPage && topicPage.qa_history) || [];
    const questions = await llm.generateSmartQuestions(entry, existingQa);
    res.json({ questions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ask a question scoped to a specific entry
app.post('/api/entries/:id/ask', async (req, res) => {
  try {
    const entry = storage.getEntry(req.params.id);
    if (!entry) return res.status(404).json({ error: 'entry not found' });
    const { question, history } = req.body;
    if (!question) return res.status(400).json({ error: 'question is required' });
    const allEntries = storage.getAllEntries();
    const related = allEntries.filter(e => {
      if (e.id === entry.id) return false;
      const eTags = new Set(e.tags || []);
      return (entry.tags || []).some(t => eTags.has(t)) || e.subject === entry.subject;
    }).slice(0, 15);
    const context = [entry, ...related];
    const result = await llm.askQuestion(question, context, history || []);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate HTML topic page for an entry
app.post('/api/entries/:id/topic-page', async (req, res) => {
  try {
    const entry = storage.getEntry(req.params.id);
    if (!entry) return res.status(404).json({ error: 'entry not found' });
    const allEntries = storage.getAllEntries();
    const related = allEntries.filter(e => {
      if (e.id === entry.id) return false;
      const eTags = new Set(e.tags || []);
      return (entry.tags || []).some(t => eTags.has(t)) || e.subject === entry.subject;
    }).slice(0, 10);
    const html = await llm.generateTopicHTML(entry, related, req.body.qaHistory || [], req.body.existingHTML || '', req.body.requirements || '', req.body.mode || '');
    res.json({ html });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;

// Save topic page (creates new version)
app.post('/api/entries/:id/topic-page/save', (req, res) => {
  try {
    const { html, qaHistory, comments, includedQaIds } = req.body;
    if (!html) return res.status(400).json({ error: 'html is required' });
    if (html.replace(/<[^>]*>/g, '').trim().length < 50) return res.status(400).json({ error: 'content too short' });
    const page = storage.saveTopicPage(req.params.id, html, qaHistory || [], comments || [], includedQaIds || []);
    res.json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all topic page versions for an entry
app.get('/api/entries/:id/topic-pages', (req, res) => {
  const pages = storage.getTopicPages(req.params.id);
  res.json({ pages });
});

// Get latest topic page for an entry
app.get('/api/entries/:id/topic-page/latest', (req, res) => {
  const page = storage.getLatestTopicPage(req.params.id);
  res.json({ page });
});

// Update comments on a topic page
app.put('/api/topic-pages/:pageId/comments', (req, res) => {
  try {
    const { comments } = req.body;
    storage.updateTopicPageComments(req.params.pageId, comments || []);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/topic-pages/:pageId/qa-history', (req, res) => {
  try {
    const { qaHistory } = req.body;
    storage.updateTopicPageQaHistory(req.params.pageId, qaHistory || []);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a specific topic page version
app.delete('/api/entries/:id/topic-page/:version', (req, res) => {
  try {
    const version = parseInt(req.params.version, 10);
    if (!version) return res.status(400).json({ error: 'invalid version' });
    const ok = storage.deleteTopicPageVersion(req.params.id, version);
    res.json({ ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a specific topic page version
app.get('/api/entries/:id/topic-page/version/:version', (req, res) => {
  try {
    const version = parseInt(req.params.version, 10);
    const page = storage.getTopicPageByVersion(req.params.id, version);
    res.json({ page });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get children of an entry (for deep analysis)
app.get('/api/entries/:id/children', (req, res) => {
  try {
    const children = storage.getChildren(req.params.id);
    res.json({ children });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Expand an entry into sub-nodes using AI
app.post('/api/entries/:id/expand', async (req, res) => {
  try {
    const entry = storage.getEntry(req.params.id);
    if (!entry) return res.status(404).json({ error: 'entry not found' });
    const topicPage = storage.getLatestTopicPage(req.params.id);
    const qaHistory = (topicPage && topicPage.qa_history) || [];
    const subTopics = await llm.expandEntry(entry, qaHistory);
    console.log(`[expand] ${entry.title}: got ${subTopics.length} sub-topics`);
    const children = [];
    for (const sub of subTopics) {
      const child = storage.addEntry({
        title: sub.title,
        content: sub.content,
        subject: entry.subject,
        tags: [sub.category, entry.title].filter(Boolean),
        source_type: 'deep-analysis',
        source_ref: entry.id,
        parent_id: entry.id,
      });
      children.push(child);
    }
    res.json({ children });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a single child entry manually
app.post('/api/entries/:id/children', (req, res) => {
  try {
    const { title, content, tags = [] } = req.body;
    const parent = storage.getEntry(req.params.id);
    if (!parent) return res.status(404).json({ error: 'parent not found' });
    const child = storage.addEntry({
      title, content,
      subject: parent.subject,
      tags,
      source_type: 'deep-analysis',
      source_ref: req.params.id,
      parent_id: req.params.id,
    });
    res.json(child);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings (prompts — tracked in git)
const settingsPath = path.join(__dirname, '..', 'config', 'prompts.json');

const DEFAULT_PROMPTS = {
  analyzePrompt: `You are a knowledge extraction assistant for a student. Analyze the following study notes and extract structured knowledge entries.

For each distinct knowledge point, return a JSON array of objects with:
- "title": concise title (under 20 chars)
- "content": the knowledge point explained clearly
- "subject": precise subject classification (see rules below)
- "tags": array of relevant tags — include ALL of the following dimensions:
  1. Core concepts: key terms, names, formulas (e.g. "科举制", "赵匡胤", "勾股定理")
  2. Category dimensions: assign multi-dimensional category tags based on the subject area:
     - For history: add tags from these dimensions where applicable:
       "政治制度", "军事战争", "经济发展", "民族关系", "对外交流", "科技发明", "文化艺术", "社会生活", "人物"
     - For math: "代数", "几何", "概率", "函数", "公式", "定理", "证明"
     - For physics: "力学", "电磁", "热学", "光学", "实验", "公式"
     - For other subjects: infer appropriate dimensional tags
  3. Connections: tags that link to related knowledge across different categories

Subject classification rules:
- For history: use specific dynasty like "历史-隋朝", "历史-唐朝", "历史-北宋" etc.
- For other subjects: use patterns like "数学-代数", "物理-力学", "化学-有机" etc.
- Each knowledge point must belong to exactly ONE specific category.

Return ONLY valid JSON array, no other text.`,
  topicPrompt: `你是一个教育内容设计师。基于以下知识点和相关资料，生成一个美观的HTML专题页面。

要求：
1. 生成完整的HTML页面（含内联CSS），适合iframe嵌入
2. 深色主题（背景 #0f1117，文字 #e0e0e0）
3. 分章节展示：导语→背景→核心内容→影响/意义→总结
4. 使用清晰的排版：标题、卡片、分隔线、高亮重点
5. 中文内容，适合中学生阅读
6. 使用你自己的知识补充完整内容，不要局限于提供的材料
7. 页面宽度100%，无需滚动条样式
8. 配色美观，使用渐变和阴影效果`,
  qaPrompt: `You are an expert study assistant with deep knowledge across all subjects. A student is studying and asks you questions.

IMPORTANT: Use your OWN comprehensive knowledge to answer thoroughly and accurately. The student's notes are supplementary context, not the boundary of your answer.

Instructions:
1. Answer using your full knowledge — be thorough, accurate, and educational
2. If the student has relevant notes, reference them to build connections
3. Use comparisons, analysis, and specific facts/data where appropriate
4. Write in Chinese, suitable for a middle/high school student
5. Suggest knowledge cards that capture KEY points — NEW knowledge beyond existing notes

Return a JSON object:
{
  "answer": "Your comprehensive answer in Chinese...",
  "suggestedCards": [
    {
      "title": "card title (under 20 chars)",
      "content": "knowledge point explained clearly",
      "subject": "precise subject like 历史-唐朝",
      "tags": ["relevant", "tags"]
    }
  ]
}

CRITICAL: The answer field must be PLAIN TEXT only — no markdown formatting.
Return ONLY valid JSON, no other text.`,
  questionsPrompt: `生成的问题应该覆盖：
1. 基本概念（是什么）
2. 原因分析（为什么）
3. 影响/意义（有什么影响）
4. 比较对比（与其他知识的关联）
5. 深入思考（评价/启示）

返回JSON数组，每个元素: {"question": "问题内容", "category": "概念/原因/影响/对比/思考"}`,
};

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); }
  catch { return { subjects: {}, defaultPrompts: DEFAULT_PROMPTS }; }
}
function saveSettings(data) {
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
}

app.get('/api/settings', (req, res) => {
  const settings = loadSettings();
  if (!settings.defaultPrompts || Object.keys(settings.defaultPrompts).length === 0) {
    settings.defaultPrompts = DEFAULT_PROMPTS;
  } else {
    for (const key of Object.keys(DEFAULT_PROMPTS)) {
      if (!settings.defaultPrompts[key]) settings.defaultPrompts[key] = DEFAULT_PROMPTS[key];
    }
  }
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  saveSettings(req.body);
  res.json({ ok: true });
});

app.get('/api/llm/config', (req, res) => {
  try {
    res.json(llm.loadLLMConfig());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/llm/config', (req, res) => {
  try {
    llm.saveLLMConfig(req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/llm/test', async (req, res) => {
  try {
    const { providerName } = req.body;
    const config = llm.loadLLMConfig();
    const providerCfg = config.providers[providerName];
    if (!providerCfg) return res.status(400).json({ error: `Unknown provider: ${providerName}` });

    if (providerName === 'agent-maestro') {
      const ok = await llm.probeAgentMaestro(config);
      return res.json({ ok, message: ok ? 'Agent Maestro is reachable' : 'Agent Maestro is not reachable' });
    }

    const result = await llm.callLLM(
      [{ role: 'user', content: 'Reply with exactly: OK' }],
      { maxTokens: 16, providers: [{ name: providerName, ...providerCfg }] }
    );
    res.json({ ok: true, message: `Response: ${result.slice(0, 100)}` });
  } catch (err) {
    res.json({ ok: false, message: err.message });
  }
});

const portalDist = path.join(__dirname, '..', 'portal', 'dist');
if (fs.existsSync(portalDist)) {
  app.use(express.static(portalDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(portalDist, 'index.html'));
  });
}

if (require.main === module) {
  app.listen(PORT, () => console.log(`StudyGraph server running on http://localhost:${PORT}`));
}

module.exports = app;
