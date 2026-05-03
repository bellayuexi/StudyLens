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

    it('GET /api/entries returns all entries', async () => {
      const res = await request(app).get('/api/entries');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/entries/:id returns 404 for nonexistent', async () => {
      const res = await request(app).get('/api/entries/nonexistent-id');
      expect(res.status).toBe(404);
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

    it('GET /api/entries/:id/topic-page/latest returns null for no pages', async () => {
      const res = await request(app).get('/api/entries/nonexistent-topic/topic-page/latest');
      expect(res.status).toBe(200);
      expect(res.body.page).toBeFalsy();
    });

    it('GET /api/entries/:id/topic-pages returns empty array for no pages', async () => {
      const res = await request(app).get('/api/entries/nonexistent-topic/topic-pages');
      expect(res.status).toBe(200);
      expect(res.body.pages).toEqual([]);
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
  });
});
