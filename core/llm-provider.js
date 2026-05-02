const http = require('http');
const https = require('https');

const DEFAULT_PROVIDERS = [
  {
    name: 'agent-maestro',
    url: () => {
      const base = (process.env.LLM_PROXY_URL || process.env.ANTHROPIC_BASE_URL || 'http://localhost:23333/api/anthropic').replace(/\/$/, '');
      return base.endsWith('/v1/messages') ? base : `${base}/v1/messages`;
    },
    model: () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    headers: () => ({ 'Content-Type': 'application/json' }),
    buildBody: (messages, model, maxTokens) => JSON.stringify({ model, max_tokens: maxTokens, messages }),
    parseResponse: (body) => {
      const data = JSON.parse(body);
      return data.content?.[0]?.text || '';
    },
  },
  {
    name: 'ollama',
    url: () => (process.env.OLLAMA_URL || 'http://localhost:11434') + '/api/chat',
    model: () => process.env.OLLAMA_MODEL || 'llama3.2',
    headers: () => ({ 'Content-Type': 'application/json' }),
    buildBody: (messages, model) => JSON.stringify({ model, messages, stream: false }),
    parseResponse: (body) => {
      const data = JSON.parse(body);
      return data.message?.content || '';
    },
  },
];

function httpRequest(urlStr, options, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(url, { method: 'POST', headers: options.headers, timeout: 120000 }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
        resolve(text);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

async function callLLM(messages, { maxTokens = 4096, providers = DEFAULT_PROVIDERS } = {}) {
  const errors = [];
  for (const p of providers) {
    try {
      const model = typeof p.model === 'function' ? p.model() : p.model;
      const url = typeof p.url === 'function' ? p.url() : p.url;
      const body = p.buildBody(messages, model, maxTokens);
      const raw = await httpRequest(url, { headers: p.headers() }, body);
      return p.parseResponse(raw);
    } catch (err) {
      errors.push(`${p.name}: ${err.message}`);
    }
  }
  throw new Error(`All LLM providers failed:\n${errors.join('\n')}`);
}

async function analyze(text, subject = '') {
  const prompt = `You are a knowledge extraction assistant for a student. Analyze the following study notes and extract structured knowledge entries.

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
  3. Connections: tags that link to related knowledge across different categories (e.g. a trade route entry could tag both "经济发展" and "对外交流")

Subject classification rules:
- For history: use specific dynasty like "历史-隋朝", "历史-唐朝", "历史-北宋", "历史-南宋", "历史-辽", "历史-西夏", "历史-金", "历史-元朝" etc. Do NOT use combined periods like "历史-隋唐".
- For other subjects: use patterns like "数学-代数", "物理-力学", "化学-有机" etc.
- Each knowledge point must belong to exactly ONE specific category.

${subject ? `User suggested subject: "${subject}" — use this as a hint but still classify precisely.` : ''}

Input notes:
${text}

Return ONLY valid JSON array, no other text.`;

  const result = await callLLM([{ role: 'user', content: prompt }]);
  const match = result.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('LLM did not return valid JSON array');
  return JSON.parse(match[0]);
}

async function findConnections(newEntry, existingEntries) {
  if (existingEntries.length === 0) return [];
  const existing = existingEntries.map(e => `[${e.id}] ${e.title}: ${e.content.slice(0, 80)}`).join('\n');
  const prompt = `Given a new knowledge entry and existing entries, find related ones.

New entry: "${newEntry.title}" — ${newEntry.content}

Existing entries:
${existing}

Return a JSON array of objects: [{"id": "existing_entry_id", "relation": "brief description of how they relate"}]
Only include genuinely related entries. Return empty array [] if none are related.
Return ONLY valid JSON, no other text.`;

  const result = await callLLM([{ role: 'user', content: prompt }], { maxTokens: 1024 });
  const match = result.match(/\[[\s\S]*\]/);
  return match ? JSON.parse(match[0]) : [];
}

async function askQuestion(question, contextEntries = []) {
  const context = contextEntries.length > 0
    ? contextEntries.map(e => `【${e.title}】(${e.subject}) ${e.content}`).join('\n\n')
    : '（暂无相关知识条目）';

  const prompt = `You are a knowledgeable study assistant. A student asks a question about their study material.

Relevant knowledge from their study notes:
${context}

Student's question: ${question}

Please:
1. Answer the question thoroughly, referencing their existing knowledge where applicable
2. Provide insights, comparisons, or analysis as appropriate
3. After the answer, suggest knowledge cards that could be created from this Q&A

Return a JSON object:
{
  "answer": "Your detailed answer in Chinese...",
  "suggestedCards": [
    {
      "title": "card title (under 20 chars)",
      "content": "knowledge point explained clearly",
      "subject": "precise subject like 历史-唐朝",
      "tags": ["relevant", "tags", "including dimensional tags like 政治制度"]
    }
  ]
}

Return ONLY valid JSON, no other text.`;

  const result = await callLLM([{ role: 'user', content: prompt }], { maxTokens: 4096 });
  const match = result.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('LLM did not return valid JSON');
  return JSON.parse(match[0]);
}

module.exports = { callLLM, analyze, findConnections, askQuestion };
