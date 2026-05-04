import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const request = require('supertest');
const app = require('../server/index.js');

describe('StudyGraph API', () => {
  // ============================
  // F1: Graph & Entry CRUD
  // ============================
  describe('F1: Graph & Entry API', () => {
    it('GET /api/graph returns entries and connections', async () => {
      const res = await request(app).get('/api/graph');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('entries');
      expect(res.body).toHaveProperty('connections');
      expect(Array.isArray(res.body.entries)).toBe(true);
    });

    it('GET /api/graph entries have has_children flag', async () => {
      const res = await request(app).get('/api/graph');
      expect(res.status).toBe(200);
      res.body.entries.forEach(e => {
        expect(e).toHaveProperty('has_children');
        expect(typeof e.has_children).toBe('boolean');
      });
    });

    it('GET /api/graph filters out child entries (parent_id set)', async () => {
      const res = await request(app).get('/api/graph');
      expect(res.status).toBe(200);
      res.body.entries.forEach(e => {
        expect(e.parent_id).toBeFalsy();
      });
    });

    it('GET /api/graph returns backend field', async () => {
      const res = await request(app).get('/api/graph');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('backend');
    });

    it('GET /api/entries returns all entries', async () => {
      const res = await request(app).get('/api/entries');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/entries supports search query', async () => {
      const res = await request(app).get('/api/entries?q=nonexistent_query_xyz');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/entries/:id returns 404 for nonexistent', async () => {
      const res = await request(app).get('/api/entries/nonexistent-id');
      expect(res.status).toBe(404);
    });

    it('PUT /api/entries/:id returns 404 for nonexistent', async () => {
      const res = await request(app)
        .put('/api/entries/nonexistent-id')
        .send({ title: 'test' });
      expect(res.status).toBe(404);
    });

    it('DELETE /api/entries/:id returns ok', async () => {
      const res = await request(app).delete('/api/entries/nonexistent-id');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  // ============================
  // F2: Topic Page CRUD
  // ============================
  describe('F2: Topic Page API', () => {
    it('POST /api/entries/:id/topic-page/save requires html', async () => {
      const res = await request(app)
        .post('/api/entries/test-id/topic-page/save')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('html');
    });

    it('POST /api/entries/:id/topic-page/save accepts valid html', async () => {
      const res = await request(app)
        .post('/api/entries/test-save-id/topic-page/save')
        .send({ html: '<p>This is a test topic page with enough content to pass the minimum length validation check for saving.</p>', qaHistory: [], comments: [] });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('version');
    });

    it('GET /api/entries/:id/topic-page/latest returns null for no pages', async () => {
      const res = await request(app).get('/api/entries/nonexistent-topic/topic-page/latest');
      expect(res.status).toBe(200);
      expect(res.body.page).toBeFalsy();
    });

    it('GET /api/entries/:id/topic-page/latest returns saved page', async () => {
      await request(app)
        .post('/api/entries/test-latest-id/topic-page/save')
        .send({ html: '<p>This is the latest topic page content with enough text to pass the minimum length validation.</p>', qaHistory: [{ question: 'Q', answer: 'A' }] });
      const res = await request(app).get('/api/entries/test-latest-id/topic-page/latest');
      expect(res.status).toBe(200);
      expect(res.body.page).toBeTruthy();
      expect(res.body.page.html).toContain('latest topic page');
    });

    it('GET /api/entries/:id/topic-pages returns empty array for no pages', async () => {
      const res = await request(app).get('/api/entries/nonexistent-topic/topic-pages');
      expect(res.status).toBe(200);
      expect(res.body.pages).toEqual([]);
    });

    it('GET /api/entries/:id/topic-pages returns pages after save', async () => {
      await request(app)
        .post('/api/entries/test-pages-id/topic-page/save')
        .send({ html: '<p>Version one of the topic page with sufficient content length for the validation to pass correctly.</p>' });
      const res = await request(app).get('/api/entries/test-pages-id/topic-pages');
      expect(res.status).toBe(200);
      expect(res.body.pages.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================
  // F2b: Topic Page Version Delete & Get
  // ============================
  describe('F2b: Topic Page Version Management', () => {
    it('DELETE /api/entries/:id/topic-page/:version returns ok', async () => {
      const res = await request(app).delete('/api/entries/test-del-id/topic-page/999');
      expect(res.status).toBe(200);
    });

    it('DELETE /api/entries/:id/topic-page/invalid returns 400', async () => {
      const res = await request(app).delete('/api/entries/test-id/topic-page/abc');
      expect(res.status).toBe(400);
    });

    it('GET /api/entries/:id/topic-page/version/:version returns page or null', async () => {
      const res = await request(app).get('/api/entries/nonexistent/topic-page/version/1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('page');
    });

    it('save then delete a version', async () => {
      await request(app)
        .post('/api/entries/test-ver-del/topic-page/save')
        .send({ html: '<p>This topic page content is meant to be deleted after saving, and it needs to be long enough to pass validation.</p>' });
      const delRes = await request(app).delete('/api/entries/test-ver-del/topic-page/1');
      expect(delRes.status).toBe(200);
      expect(delRes.body.ok).toBe(true);
      const getRes = await request(app).get('/api/entries/test-ver-del/topic-page/version/1');
      expect(getRes.body.page).toBeFalsy();
    });
  });

  // ============================
  // F3: Ingest
  // ============================
  describe('F3: Ingest API', () => {
    it('POST /api/ingest requires text', async () => {
      const res = await request(app)
        .post('/api/ingest')
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /api/ingest/url requires url', async () => {
      const res = await request(app)
        .post('/api/ingest/url')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('url');
    });

    it('POST /api/ingest/file requires file', async () => {
      const res = await request(app)
        .post('/api/ingest/file');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('file');
    });
  });

  // ============================
  // F4: Children / Deep Analysis
  // ============================
  describe('F4: Deep Analysis API', () => {
    it('GET /api/entries/:id/children returns children array', async () => {
      const res = await request(app).get('/api/entries/nonexistent/children');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('children');
      expect(Array.isArray(res.body.children)).toBe(true);
    });

    it('POST /api/entries/:id/children returns 404 for nonexistent parent', async () => {
      const res = await request(app)
        .post('/api/entries/nonexistent/children')
        .send({ title: 'Child', content: 'Content' });
      expect(res.status).toBe(404);
    });

    it('POST /api/entries/:id/expand returns 404 for nonexistent entry', async () => {
      const res = await request(app)
        .post('/api/entries/nonexistent/expand');
      expect(res.status).toBe(404);
    });
  });

  // ============================
  // F5: Smart Questions
  // ============================
  describe('F5: Smart Questions API', () => {
    it('POST /api/entries/:id/smart-questions returns 404 for nonexistent entry', async () => {
      const res = await request(app)
        .post('/api/entries/nonexistent/smart-questions');
      expect(res.status).toBe(404);
    });

    it('POST /api/entries/:id/questions returns 404 for nonexistent entry', async () => {
      const res = await request(app)
        .post('/api/entries/nonexistent/questions');
      expect(res.status).toBe(404);
    });

    it('POST /api/entries/:id/ask returns 404 for nonexistent entry', async () => {
      const res = await request(app)
        .post('/api/entries/nonexistent/ask')
        .send({ question: 'test?' });
      expect(res.status).toBe(404);
    });

    it('POST /api/entries/:id/ask requires question', async () => {
      // Need a valid entry; use topic-page save to create context
      const res = await request(app)
        .post('/api/entries/nonexistent/ask')
        .send({});
      // Will be 404 (entry not found) before question check
      expect(res.status).toBe(404);
    });
  });

  // ============================
  // F6: Connections
  // ============================
  describe('F6: Connections API', () => {
    it('POST /api/connections requires from_id and to_id', async () => {
      const res = await request(app)
        .post('/api/connections')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('from_id');
    });

    it('POST /api/connections requires to_id', async () => {
      const res = await request(app)
        .post('/api/connections')
        .send({ from_id: 'a' });
      expect(res.status).toBe(400);
    });
  });

  // ============================
  // F7: Topic Page Comments & QA History
  // ============================
  describe('F7: Topic Page Updates', () => {
    it('PUT /api/topic-pages/:pageId/comments updates comments', async () => {
      const res = await request(app)
        .put('/api/topic-pages/some-page-id/comments')
        .send({ comments: [{ id: 1, text: 'test comment' }] });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('PUT /api/topic-pages/:pageId/qa-history updates qa history', async () => {
      const res = await request(app)
        .put('/api/topic-pages/some-page-id/qa-history')
        .send({ qaHistory: [{ question: 'Q', answer: 'A' }] });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  // ============================
  // F8: QA & Restructure Validation
  // ============================
  describe('F8: QA & Other Endpoints', () => {
    it('POST /api/qa requires question', async () => {
      const res = await request(app)
        .post('/api/qa')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('question');
    });

    it('POST /api/qa/save requires cards', async () => {
      const res = await request(app)
        .post('/api/qa/save')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('cards');
    });

    it('POST /api/qa/mindmap requires question', async () => {
      const res = await request(app)
        .post('/api/qa/mindmap')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('question');
    });

    it('POST /api/restructure requires instruction', async () => {
      const res = await request(app)
        .post('/api/restructure')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('instruction');
    });
  });

  // ============================
  // F9: Settings API
  // ============================
  describe('F9: Settings API', () => {
    it('GET /api/settings returns defaultPrompts with all keys', async () => {
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('defaultPrompts');
      expect(res.body.defaultPrompts).toHaveProperty('analyzePrompt');
      expect(res.body.defaultPrompts).toHaveProperty('topicPrompt');
      expect(res.body.defaultPrompts).toHaveProperty('qaPrompt');
      expect(res.body.defaultPrompts).toHaveProperty('questionsPrompt');
    });

    it('GET /api/settings returns non-empty default prompts', async () => {
      const res = await request(app).get('/api/settings');
      expect(res.body.defaultPrompts.analyzePrompt.length).toBeGreaterThan(50);
      expect(res.body.defaultPrompts.questionsPrompt.length).toBeGreaterThan(20);
    });

    it('PUT /api/settings saves and returns ok', async () => {
      const res = await request(app)
        .put('/api/settings')
        .send({ subjects: {}, defaultPrompts: {} });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('GET /api/settings still returns defaults after saving empty', async () => {
      await request(app)
        .put('/api/settings')
        .send({ subjects: {}, defaultPrompts: {} });
      const res = await request(app).get('/api/settings');
      expect(res.body.defaultPrompts.analyzePrompt.length).toBeGreaterThan(50);
    });
  });
});
