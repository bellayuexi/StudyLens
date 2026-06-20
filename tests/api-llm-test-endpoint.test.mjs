import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
import http from 'http';

const require = createRequire(import.meta.url);

// Load the REAL llm-provider (no mock) so the /api/llm/test path exercises
// buildProvider + callLLM end-to-end. Regression guard: the endpoint used to
// pass a raw config object to callLLM, which has no buildBody()/headers() and
// threw "p.buildBody is not a function" for openai-compatible / ollama.
const appPath = require.resolve('../server/index.js');
delete require.cache[appPath];
const llmPath = require.resolve('../core/llm-provider');
delete require.cache[llmPath];

const llm = require('../core/llm-provider');
const request = require('supertest');
const app = require('../server/index.js');

describe('POST /api/llm/test', () => {
  let fakeServer;
  let fakeUrl;
  let lastRequest = null;
  let originalConfig;

  beforeAll(async () => {
    // Fake OpenAI-compatible endpoint
    fakeServer = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        lastRequest = {
          url: req.url,
          auth: req.headers['authorization'],
          body: JSON.parse(Buffer.concat(chunks).toString() || '{}'),
        };
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }));
      });
    });
    await new Promise(resolve => fakeServer.listen(0, '127.0.0.1', resolve));
    const port = fakeServer.address().port;
    fakeUrl = `http://127.0.0.1:${port}/v1`;

    originalConfig = llm.loadLLMConfig();
  });

  afterAll(async () => {
    llm.saveLLMConfig(originalConfig);
    await new Promise(resolve => fakeServer.close(resolve));
  });

  it('builds a real provider and succeeds for openai-compatible', async () => {
    const config = llm.loadLLMConfig();
    config.providers = config.providers || {};
    config.providers['openai-compatible'] = {
      enabled: true,
      baseUrl: fakeUrl,
      apiKey: 'test-key-123',
      model: 'gpt-test',
    };
    llm.saveLLMConfig(config);

    const res = await request(app)
      .post('/api/llm/test')
      .send({ providerName: 'openai-compatible' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.message).toContain('OK');

    // The provider was correctly constructed: right URL, auth header, body shape.
    expect(lastRequest.url).toBe('/v1/chat/completions');
    expect(lastRequest.auth).toBe('Bearer test-key-123');
    expect(lastRequest.body.model).toBe('gpt-test');
  });

  it('returns ok:false with a message on connection failure, not a crash', async () => {
    const config = llm.loadLLMConfig();
    config.providers = config.providers || {};
    config.providers['openai-compatible'] = {
      enabled: true,
      baseUrl: 'http://127.0.0.1:1/v1',
      apiKey: 'x',
      model: 'gpt-test',
    };
    llm.saveLLMConfig(config);

    const res = await request(app)
      .post('/api/llm/test')
      .send({ providerName: 'openai-compatible' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(typeof res.body.message).toBe('string');
    expect(res.body.message.length).toBeGreaterThan(0);
  });

  it('rejects an unknown provider', async () => {
    const res = await request(app)
      .post('/api/llm/test')
      .send({ providerName: 'does-not-exist' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('does-not-exist');
  });
});
