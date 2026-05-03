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

async function askQuestion(question, contextEntries = [], history = []) {
  const context = contextEntries.length > 0
    ? contextEntries.map(e => `【${e.title}】(${e.subject}) ${e.content}`).join('\n\n')
    : '';

  const systemPrompt = `You are an expert study assistant with deep knowledge across all subjects. A student is studying and asks you questions.

IMPORTANT: Use your OWN comprehensive knowledge to answer thoroughly and accurately. The student's notes are supplementary context, not the boundary of your answer.

${context ? `The student's existing study notes for reference:\n${context}\n` : ''}

Instructions:
1. Answer using your full knowledge — be thorough, accurate, and educational
2. If the student has relevant notes, reference them to build connections
3. Use comparisons, analysis, and specific facts/data where appropriate
4. Write in Chinese, suitable for a middle/high school student
5. Suggest knowledge cards that capture KEY points — NEW knowledge beyond existing notes
6. In follow-up turns, refine/expand based on the student's feedback. Accumulate ALL worthy knowledge cards from the entire conversation, not just the latest turn.

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

CRITICAL: The answer field must be PLAIN TEXT only — no markdown formatting (no **, no ##, no -).
Return ONLY valid JSON, no other text. Do not wrap in code fences.`;

  const messages = [
    { role: 'user', content: systemPrompt },
    { role: 'assistant', content: '{"answer": "好的，我准备好了，请提问。", "suggestedCards": []}' },
  ];
  for (const h of history) {
    messages.push({ role: 'user', content: h.question });
    if (h.answer) messages.push({ role: 'assistant', content: JSON.stringify({ answer: h.answer, suggestedCards: h.suggestedCards || [] }) });
  }
  messages.push({ role: 'user', content: question });

  const result = await callLLM(messages, { maxTokens: 4096 });
  const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('LLM did not return valid JSON');
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    const fixed = match[0].replace(/(?<=:\s*"[^"]*)\n/g, '\\n');
    try { return JSON.parse(fixed); } catch {}
    const ansMatch = match[0].match(/"answer"\s*:\s*"([\s\S]*?)"\s*,\s*"suggestedCards"/);
    return { answer: ansMatch ? ansMatch[1].replace(/\\n/g, '\n') : result, suggestedCards: [] };
  }
}

async function restructure(instruction, entries) {
  const entrySummary = entries.map(e =>
    `[${e.id}] title="${e.title}" subject="${e.subject}" tags=${JSON.stringify(e.tags)} content="${e.content.slice(0, 60)}"`
  ).join('\n');

  const prompt = `You are a knowledge graph organizer. A student has the following knowledge entries and wants to restructure them.

Student's instruction: "${instruction}"

Current entries:
${entrySummary}

Based on the instruction, return a JSON array of changes to make. Each change is an object:
- "action": "update" (modify subject/tags/title of existing entry) or "merge" (combine entries) or "split" (split one entry into multiple)
- For "update": { "action": "update", "id": "entry_id", "subject": "new_subject", "tags": ["new","tags"], "title": "new_title_if_changed" }
- For "merge": { "action": "merge", "ids": ["id1","id2",...], "merged_title": "combined title", "merged_content": "combined content", "subject": "subject", "tags": ["tags"] }
- For "split": not commonly needed, skip for now

Only include entries that actually need changes. Return ONLY valid JSON array, no other text.
If no changes are needed, return [].`;

  const result = await callLLM([{ role: 'user', content: prompt }], { maxTokens: 4096 });
  const match = result.match(/\[[\s\S]*\]/);
  return match ? JSON.parse(match[0]) : [];
}

async function buildQAMindMap(question, answer, cards, relatedEntries) {
  const context = [
    `Question: ${question}`,
    `Answer: ${answer}`,
    cards.length > 0 ? `Cards: ${JSON.stringify(cards.map(c => ({ title: c.title, content: c.content, subject: c.subject })))}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `Based on this Q&A exchange, create a structured visualization to help a student understand the answer.

${context}

Detect the type of question and generate the appropriate visualization:

1. If it's a COMPARISON question (对比, 区别, 异同, vs, 不同, 对应, 差别):
Return:
{
  "type": "comparison",
  "title": "对比标题",
  "columns": [
    { "header": "左侧标题", "color": "#4285f4", "items": [
      { "category": "维度1", "content": "内容" },
      { "category": "维度2", "content": "内容" }
    ]},
    { "header": "右侧标题", "color": "#ea4335", "items": [
      { "category": "维度1", "content": "内容" },
      { "category": "维度2", "content": "内容" }
    ]}
  ],
  "summary": "一句话总结核心区别"
}

2. If it's a TIMELINE/PROCESS question (过程, 经过, 发展, 变化, 顺序):
Return:
{
  "type": "timeline",
  "title": "标题",
  "steps": [
    { "label": "阶段名", "content": "描述", "date": "时间（可选）" }
  ]
}

3. For other questions (concepts, explanations, analysis):
Return:
{
  "type": "tree",
  "title": "中心主题",
  "branches": [
    { "label": "分支1", "children": [
      { "label": "要点", "detail": "说明" }
    ]}
  ]
}

Rules:
- All text in Chinese, concise and clear
- For comparison: items MUST align by category across columns for easy side-by-side reading
- For tree: max 4 branches, max 4 children each
- Return ONLY valid JSON, no other text.`;

  const result = await callLLM([{ role: 'user', content: prompt }], { maxTokens: 4096, providers: [DEFAULT_PROVIDERS[0]] });
  const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) { console.warn('[buildQAMindMap] no JSON found'); return { type: 'tree', title: '', branches: [] }; }
  let raw = match[0];
  try { return JSON.parse(raw); } catch (e1) {
    // Fix common issues: trailing commas, unescaped newlines in strings
    raw = raw.replace(/,\s*([\]}])/g, '$1');
    raw = raw.replace(/(?<=:\s*"[^"]*)\n/g, '\\n');
    try { return JSON.parse(raw); } catch (e2) {
      console.warn('[buildQAMindMap] parse error after fix:', e2.message, 'raw tail:', raw.slice(-100));
      return { type: 'tree', title: '', branches: [] };
    }
  }
}

async function generateSmartQuestions(entry, existingQaHistory = []) {
  const existingSection = existingQaHistory.length > 0
    ? `\n以下问题已经被回答过，请不要生成与这些问题重复或高度相似的问题：\n${existingQaHistory.map(h => `- ${h.question}`).join('\n')}\n`
    : '';

  const prompt = `你是一个学习辅导助手。根据以下知识点，生成5个有深度的学习问题，帮助学生深入理解这个知识点。

知识点标题: ${entry.title}
学科分类: ${entry.subject}
内容: ${entry.content}
标签: ${(entry.tags || []).join(', ')}
${existingSection}
生成的问题应该覆盖：
1. 基本概念（是什么）
2. 原因分析（为什么）
3. 影响/意义（有什么影响）
4. 比较对比（与其他知识的关联）
5. 深入思考（评价/启示）

返回JSON数组，每个元素: {"question": "问题内容", "category": "概念/原因/影响/对比/思考"}
重要：问题文本中如果要引用术语，请用「」而不是引号，避免JSON解析错误。
只返回JSON，不要其他文字。`;

  const result = await callLLM([{ role: 'user', content: prompt }], { maxTokens: 1024 });
  const stripped = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) { console.error('[smartQ] no match in LLM response:', result.slice(0, 200)); return []; }
  try { return JSON.parse(match[0]); } catch (e1) {
    // Repair: extract question/category pairs via regex
    const items = [];
    const re = /[“"]question[”"]\s*:\s*[“"]([^”"]*(?:[“"][^”"]*)*)[”"]\s*,\s*[“"]category[”"]\s*:\s*[“"]([^”"]*)[”"]/g;
    let rm;
    while ((rm = re.exec(match[0])) !== null) items.push({ question: rm[1], category: rm[2] });
    if (items.length > 0) return items;
    console.error("[smartQ] parse fail", e1.message);
    return [];
  }
}

const TOPIC_LOG_DIR = require('path').join(__dirname, '..', 'logs', 'topic-gen');
require('fs').mkdirSync(TOPIC_LOG_DIR, { recursive: true });

function logTopicGen(label, data) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = require('path').join(TOPIC_LOG_DIR, `${ts}_${label}.json`);
  require('fs').writeFileSync(logPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`[topic-gen] ${label}: prompt=${data.promptLength} chars, qaContext=${data.qaContextLength} chars, existingText=${data.existingTextLength} chars, result=${data.resultLength} chars`);
}

async function generateTopicHTML(entry, relatedEntries = [], qaHistory = [], existingHTML = '', requirements = '', mode = '') {
  const related = relatedEntries.map(e => `【${e.title}】${e.content.slice(0, 100)}`).join('\n');

  // Mode-based prompt construction:
  // 'annotation' - existing HTML + annotation text only, no QA
  // 'merge' - existing HTML + merge instructions, no QA
  // 'incremental' - existing HTML + only new QA items
  // 'regenerate' - ignore existing HTML, fresh generation with QA
  // '' (default) - legacy behavior: all QA + existing HTML

  const skipQA = mode === 'annotation' || mode === 'merge';
  const skipExisting = mode === 'regenerate';

  let qaContext = '';
  if (!skipQA && qaHistory.length > 0) {
    const categories = {};
    qaHistory.filter(h => h.answer).forEach(h => {
      const cat = h.category || '其他';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(h);
    });
    qaContext = Object.entries(categories).map(([cat, items]) =>
      `【${cat}类问题】\n` + items.map(h => `Q: ${h.question}\nA: ${(h.answer || '').slice(0, 800)}`).join('\n\n')
    ).join('\n\n---\n\n');
  }

  const isUpdate = !skipExisting && !!existingHTML;
  const existingText = isUpdate ? existingHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 5000) : '';

  let taskDescription, contentSection, requirementsList;

  if (mode === 'annotation') {
    const annotationHTML = existingHTML.slice(0, 15000);
    taskDescription = '根据用户批注对现有专题页面做局部修改';
    contentSection = `当前专题页完整HTML（必须在此基础上做最小化修改）:\n${annotationHTML}\n`;
    requirementsList = `要求：
1. 【最重要】仅根据用户批注做最小化局部修改，严格保留原有的所有内容、章节结构、CSS样式、颜色、强调效果
2. 直接输出修改后的完整HTML页面，保持原有的内联CSS和所有样式不变
3. 不要删除任何批注未提及的内容
4. 不要改变任何未涉及部分的格式、颜色、渐变、阴影等视觉效果
5. 只修改批注明确要求修改的部分
6. 【用户批注】${requirements}`;
  } else if (mode === 'merge') {
    taskDescription = '合并多个版本的专题页内容';
    contentSection = `基础版本内容:\n${existingText}\n`;
    requirementsList = `要求：
1. 合并两个版本的内容，保留所有有价值的信息
2. 生成完整的HTML页面（含内联CSS），适合iframe嵌入
3. 深色主题（背景 #0f1117，文字 #e0e0e0）
4. 分章节展示，结构清晰
5. 中文内容，适合中学生阅读
6. 页面宽度100%，配色美观，使用渐变和阴影效果
7. 【合并要求】${requirements}`;
  } else {
    taskDescription = `基于以下知识点和相关资料，${isUpdate ? '更新并扩充' : '生成'}一个美观的HTML专题页面`;
    contentSection = '';
    if (qaContext) contentSection += `=== 核心问答内容（必须全部融入专题页） ===\n${qaContext}\n`;
    if (isUpdate) contentSection += `当前专题页内容（需要在此基础上扩充和完善）:\n${existingText}\n请在现有内容的基础上扩充，保留原有结构，将新的问答内容融入对应章节。\n`;
    requirementsList = `要求：
1. 生成完整的HTML页面（含内联CSS），适合iframe嵌入
2. 深色主题（背景 #0f1117，文字 #e0e0e0）
3. 分章节展示：导语→背景→核心内容→影响/意义→总结
4. 使用清晰的排版：标题、卡片、分隔线、高亮重点
5. 中文内容，适合中学生阅读
6. 使用你自己的知识补充完整内容，不要局限于提供的材料
7. 页面宽度100%，无需滚动条样式
8. 配色美观，使用渐变和阴影效果
${qaContext ? '9. 【重要】上面的问答内容是学生深入探索的结果，必须将每个问答的核心答案完整融入专题页对应章节中，不可遗漏任何一个问答\n' : ''}${requirements ? `10. 【用户特别要求】${requirements}` : ''}`;
  }

  const prompt = `你是一个教育内容设计师。${taskDescription}。

主题知识点:
标题: ${entry.title}
学科: ${entry.subject}
内容: ${entry.content}

${related && !skipQA ? `相关知识点:\n${related}\n` : ''}
${contentSection}
${requirementsList}

只返回HTML代码，不要包裹在代码块中。`;

  const logData = {
    entryTitle: entry.title, entrySubject: entry.subject,
    mode: mode || 'default', isUpdate, requirements: (requirements || '').slice(0, 200),
    relatedLength: related.length, qaContextLength: qaContext.length,
    existingTextLength: existingText.length, promptLength: prompt.length,
    qaCount: qaHistory.filter(h => h.answer).length,
    existingHTMLLength: existingHTML.length,
  };
  console.log(`[topic-gen] START: "${entry.title}" mode=${mode || 'default'} isUpdate=${isUpdate} prompt=${prompt.length} chars`);

  const result = await callLLM([{ role: 'user', content: prompt }], { maxTokens: 16384 });
  let html = result.replace(/```html\s*/g, '').replace(/```\s*/g, '').trim();
  if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
    html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="background:#0f1117;color:#e0e0e0;font-family:system-ui;padding:24px">${html}</body></html>`;
  }
  if (html.replace(/<[^>]*>/g, '').trim().length < 50) {
    console.log(`[topic-gen] RETRY: first result too short (${html.replace(/<[^>]*>/g, '').trim().length} chars text)`);
    logData.firstResultLength = html.length;
    logData.firstResultTextLength = html.replace(/<[^>]*>/g, '').trim().length;
    logData.firstResultPreview = html.slice(0, 500);
    const retry = await callLLM([{ role: 'user', content: prompt }], { maxTokens: 16384 });
    let retryHtml = retry.replace(/```html\s*/g, '').replace(/```\s*/g, '').trim();
    if (!retryHtml.includes('<html') && !retryHtml.includes('<!DOCTYPE')) {
      retryHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="background:#0f1117;color:#e0e0e0;font-family:system-ui;padding:24px">${retryHtml}</body></html>`;
    }
    if (retryHtml.replace(/<[^>]*>/g, '').trim().length > html.replace(/<[^>]*>/g, '').trim().length) {
      html = retryHtml;
    }
    logData.retried = true;
    logData.retryResultTextLength = retryHtml.replace(/<[^>]*>/g, '').trim().length;
  }
  logData.resultLength = html.length;
  logData.resultTextLength = html.replace(/<[^>]*>/g, '').trim().length;
  logTopicGen(isUpdate ? 'update' : 'generate', logData);
  return html;
}

async function expandEntry(entry, qaHistory = []) {
  const qaContext = qaHistory.filter(h => h.answer).length > 0
    ? '\n\n学生已探索过的问题:\n' + qaHistory.filter(h => h.answer).map(h => `Q: ${h.question}\nA: ${h.answer.slice(0, 200)}`).join('\n\n')
    : '';
  const prompt = `你是一个学习辅导助手。请将以下知识点拆解为多个子知识点，用于深入分析。

知识点标题: ${entry.title}
学科分类: ${entry.subject}
内容: ${entry.content}
标签: ${(entry.tags || []).join(', ')}
${qaContext}

请拆解为5-8个子知识点，每个子知识点应该是该主题下的一个具体方面。
${qaContext ? '参考学生已探索过的问题，确保子知识点覆盖这些方向，并补充学生尚未涉及的重要方面。' : '例如「王安石变法」可以拆解为：背景、青苗法、免役法、市易法、保甲法、影响与评价等。'}

返回JSON数组，每个元素: {"title": "子知识点标题", "content": "简要描述（50-100字）", "category": "背景/内容/影响/对比/评价"}
重要：文本中引用术语请用「」而不是引号，避免JSON解析错误。
只返回JSON，不要其他文字。`;

  const result = await callLLM([{ role: 'user', content: prompt }], { maxTokens: 2048 });
  const stripped = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try { return JSON.parse(match[0]); } catch (e1) {
    const items = [];
    const re = /[“””]title[“””]\s*:\s*[“””]([^”””]+)[“””]\s*,\s*[“””]content[“””]\s*:\s*[“””]([^”””]+)[“””]\s*,\s*[“””]category[“””]\s*:\s*[“””]([^”””]+)[“””]/g;
    let rm;
    while ((rm = re.exec(match[0])) !== null) items.push({ title: rm[1], content: rm[2], category: rm[3] });
    if (items.length > 0) return items;
    return [];
  }
}

module.exports = { callLLM, analyze, findConnections, askQuestion, restructure, buildQAMindMap, generateSmartQuestions, generateTopicHTML, expandEntry };
