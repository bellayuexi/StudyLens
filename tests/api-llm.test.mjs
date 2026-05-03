import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Inject mock into require cache before loading the app
const mockLlm = {
  analyze: vi.fn().mockResolvedValue([
    { title: 'Test Entry', content: 'Test content', subject: 'Test', tags: ['tag1'] },
  ]),
  findConnections: vi.fn().mockResolvedValue([]),
  askQuestion: vi.fn().mockResolvedValue({ answer: 'Test answer', suggestedCards: [] }),
  generateSmartQuestions: vi.fn().mockResolvedValue([
    { question: 'What is X?', category: '概念' },
  ]),
  generateTopicHTML: vi.fn().mockResolvedValue('<html><body><h1>Topic</h1><p>Generated topic page content for testing.</p></body></html>'),
  expandEntry: vi.fn().mockResolvedValue([
    { title: 'Sub Topic 1', content: 'Sub content', category: '概念' },
  ]),
  restructure: vi.fn().mockResolvedValue([]),
  buildQAMindMap: vi.fn().mockResolvedValue({ type: 'tree', title: 'Test', branches: [{ label: 'A' }] }),
};

// Pre-populate require cache with mock
const llmPath = require.resolve('../core/llm-provider');
require.cache[llmPath] = { id: llmPath, filename: llmPath, loaded: true, exports: mockLlm };

// Clear app cache so it picks up our mock
const appPath = require.resolve('../server/index.js');
delete require.cache[appPath];

const request = require('supertest');
const app = require('../server/index.js');

describe('API with mocked LLM', () => {
  const createdIds = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await request(app).delete(`/api/entries/${id}`);
    }
    const fs = require('fs');
    const { fileURLToPath } = require('url');
    const path = require('path');
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const entriesPath = path.join(dir, '..', 'wiki', 'index', 'entries.json');
    try {
      const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));
      const testSubjects = ['Test', '测试'];
      const testTitles = ['Test Entry', 'Card 1'];
      const clean = entries.filter(e => !testSubjects.includes(e.subject) && !testTitles.includes(e.title));
      if (clean.length < entries.length) {
        fs.writeFileSync(entriesPath, JSON.stringify(clean, null, 2));
      }
    } catch {}
  });

  describe('F1: Ingest Flow', () => {
    it('POST /api/ingest creates entries from text', async () => {
      const res = await request(app)
        .post('/api/ingest')
        .send({ text: '王安石变法是北宋时期的重大改革', subject: '历史' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('created');
      expect(res.body.created.length).toBe(1);
      expect(res.body.created[0].title).toBe('Test Entry');
      createdIds.push(...res.body.created.map(c => c.id));
    });
  });

  describe('F2: QA Flow', () => {
    it('POST /api/qa returns answer', async () => {
      const res = await request(app)
        .post('/api/qa')
        .send({ question: '什么是王安石变法？' });
      expect(res.status).toBe(200);
      expect(res.body.answer).toBe('Test answer');
    });

    it('POST /api/qa with history', async () => {
      const res = await request(app)
        .post('/api/qa')
        .send({
          question: '影响是什么？',
          history: [{ question: 'Q1', answer: 'A1' }],
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('answer');
    });

    it('POST /api/qa/save creates entries from cards', async () => {
      const res = await request(app)
        .post('/api/qa/save')
        .send({
          question: 'test',
          cards: [{ title: 'Card 1', content: 'Content 1', subject: 'Test', tags: [] }],
        });
      expect(res.status).toBe(200);
      expect(res.body.created.length).toBe(1);
      createdIds.push(...res.body.created.map(c => c.id));
    });
  });

  describe('F3: Mindmap', () => {
    it('POST /api/qa/mindmap returns tree structure', async () => {
      const res = await request(app)
        .post('/api/qa/mindmap')
        .send({ question: '什么是X？', answer: '答案' });
      expect(res.status).toBe(200);
      expect(res.body.type).toBe('tree');
    });
  });

  describe('F4: Entry-scoped Operations', () => {
    let entryId;

    it('creates entry via ingest', async () => {
      const res = await request(app)
        .post('/api/ingest')
        .send({ text: '测试条目', subject: '测试' });
      expect(res.status).toBe(200);
      entryId = res.body.created[0].id;
      createdIds.push(entryId);
    });

    it('GET /api/entries with sqlite backend finds ingested entry', async () => {
      const res = await request(app).get('/api/entries?backend=sqlite');
      expect(res.status).toBe(200);
      const found = res.body.find(e => e.id === entryId);
      expect(found).toBeTruthy();
    });

    it('GET /api/entries/:id with sqlite backend returns entry', async () => {
      const res = await request(app).get(`/api/entries/${entryId}?backend=sqlite`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(entryId);
    });

    it('DELETE /api/entries/:id deletes entry', async () => {
      const delRes = await request(app).delete(`/api/entries/${entryId}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.ok).toBe(true);
    });

    it('DELETE /api/entries/:id deletes entry', async () => {
      const delRes = await request(app).delete(`/api/entries/${entryId}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.ok).toBe(true);
    });
  });

  describe('F5: Restructure', () => {
    it('POST /api/restructure processes instruction', async () => {
      const res = await request(app)
        .post('/api/restructure')
        .send({ instruction: '合并测试条目' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
    });

    it('POST /api/restructure with subject filter', async () => {
      const res = await request(app)
        .post('/api/restructure')
        .send({ instruction: '整理', subject: '测试' });
      expect(res.status).toBe(200);
    });
  });
});
