import { test, expect } from '@playwright/test';

async function seedEntry(request, { title, content, subject = '', tags = [] }) {
  const res = await request.post('/api/test/seed', {
    data: { title, content, subject, tags },
  });
  return await res.json();
}

async function clearAll(request) {
  const res = await request.get('/api/graph?backend=wiki');
  const text = await res.text();
  try {
    const { entries } = JSON.parse(text);
    for (const e of (entries || [])) {
      await request.delete(`/api/entries/${e.id}`);
    }
  } catch { /* no entries */ }
}

const TOPIC_HTML = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>Topic</title></head><body><h1>Topic Page</h1><p>Content here</p></body></html>`;

function mockTopicPages(page, entryId, html = null) {
  return Promise.all([
    page.route(`**/api/entries/${entryId}/topic-page/latest`, route => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ page: html ? { id: 'tp-1', version: 1, html, qa_history: [], comments: [], included_qa_ids: [], created_at: '2026-01-01' } : null }),
      });
    }),
    page.route(`**/api/entries/${entryId}/topic-pages`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pages: html ? [{ version: 1, created_at: '2026-01-01' }] : [] }) });
    }),
  ]);
}

// ─── QA Panel ───────────────────────────────────────────────

test.describe('QA Panel', () => {
  test.beforeEach(async ({ request }) => { await clearAll(request); });
  test.afterEach(async ({ request }) => { await clearAll(request); });

  test('ask question and receive answer', async ({ page, request }) => {
    const entry = await seedEntry(request, { title: 'QA测试', content: '测试内容', subject: '测试' });
    await mockTopicPages(page, entry.id);

    await page.route('**/api/qa', route => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ answer: '这是AI回答', cards: [], sources: [] }),
      });
    });

    await page.goto('/');
    await page.getByText('QA测试').first().click();
    await expect(page.getByText('QA测试').first()).toBeVisible({ timeout: 5000 });

    const qaInput = page.locator('input[placeholder*="问"], textarea[placeholder*="问"]').first();
    if (await qaInput.isVisible({ timeout: 3000 })) {
      await qaInput.fill('这是一个测试问题');
      await page.getByRole('button', { name: /提问/ }).first().click();
      await expect(page.getByText('这是AI回答')).toBeVisible({ timeout: 10000 });
    }
  });

  test('new conversation button resets QA history', async ({ page, request }) => {
    const entry = await seedEntry(request, { title: 'QA重置', content: '内容', subject: '测试' });
    await mockTopicPages(page, entry.id);

    let callCount = 0;
    await page.route('**/api/qa', route => {
      callCount++;
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ answer: `回答${callCount}`, cards: [], sources: [] }),
      });
    });

    await page.goto('/');
    await page.getByText('QA重置').first().click();

    const qaInput = page.locator('input[placeholder*="问"], textarea[placeholder*="问"]').first();
    if (await qaInput.isVisible({ timeout: 3000 })) {
      await qaInput.fill('第一个问题');
      await page.getByRole('button', { name: /提问/ }).first().click();
      await expect(page.getByText('回答1')).toBeVisible({ timeout: 10000 });

      const newConvBtn = page.getByText('新对话');
      if (await newConvBtn.isVisible({ timeout: 2000 })) {
        await newConvBtn.click();
        await expect(page.getByText('回答1')).not.toBeVisible({ timeout: 3000 });
      }
    }
  });
});

// ─── Topic Page Generation ──────────────────────────────────

test.describe('Topic Page', () => {
  test.beforeEach(async ({ request }) => { await clearAll(request); });
  test.afterEach(async ({ request }) => { await clearAll(request); });

  test('generate topic page via custom requirements', async ({ page, request }) => {
    const entry = await seedEntry(request, { title: '综述测试', content: '综述内容', subject: '测试' });
    await mockTopicPages(page, entry.id);

    // Register save route BEFORE the catch-all topic-page route
    await page.route(`**/api/entries/${entry.id}/topic-page/save`, route => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 'tp-new', version: 1, created_at: '2026-01-01' }),
      });
    });
    await page.route(`**/api/entries/${entry.id}/topic-page`, route => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ html: '<h1>生成的综述</h1><p>这是一段关于综述测试的详细内容，包含了丰富的历史背景知识和分析讨论，足够长以满足最低字数要求。</p>' }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/');
    await page.getByText('综述测试').first().click();

    // Click "手工输入需求" to enter custom requirements mode
    const customReqBtn = page.getByText('手工输入需求');
    await expect(customReqBtn).toBeVisible({ timeout: 5000 });
    await customReqBtn.click();

    // Fill in requirements and submit
    const reqInput = page.locator('textarea[placeholder*="描述你的学习需求"]');
    await expect(reqInput).toBeVisible({ timeout: 3000 });
    await reqInput.fill('重点讲解背景');

    const genBtn = page.getByRole('button', { name: /生成专题页/ });
    await expect(genBtn).toBeEnabled({ timeout: 3000 });
    await genBtn.click();

    await expect(page.getByText(/v1 已保存/)).toBeVisible({ timeout: 15000 });
  });

  test('export HTML button appears after topic page exists', async ({ page, request }) => {
    const entry = await seedEntry(request, { title: '导出测试', content: '内容', subject: '测试' });
    await mockTopicPages(page, entry.id, TOPIC_HTML);

    await page.goto('/');
    await page.getByText('导出测试').first().click();
    await expect(page.getByText(/导出HTML/)).toBeVisible({ timeout: 10000 });
  });
});

// ─── Entry Field Editing ────────────────────────────────────

test.describe('Entry Field Editing', () => {
  test.beforeEach(async ({ request }) => { await clearAll(request); });
  test.afterEach(async ({ request }) => { await clearAll(request); });

  test('edit entry title inline', async ({ page, request }) => {
    const entry = await seedEntry(request, { title: '原始标题', content: '内容', subject: '测试' });
    await mockTopicPages(page, entry.id);

    await page.goto('/');
    await page.getByText('原始标题').first().click();
    const titleEl = page.locator('h2').filter({ hasText: '原始标题' });
    await expect(titleEl).toBeVisible({ timeout: 5000 });

    // Click title to enter edit mode
    await titleEl.click();

    // The title h2 is replaced by an autoFocused input; target the focused element
    const editInput = page.locator('input:focus');
    await expect(editInput).toBeVisible({ timeout: 3000 });
    await editInput.fill('修改后标题');
    await editInput.press('Enter');

    await expect(page.getByText('修改后标题')).toBeVisible({ timeout: 5000 });
  });

  test('add tag to entry', async ({ page, request }) => {
    const entry = await seedEntry(request, { title: '标签测试', content: '内容', subject: '测试', tags: ['已有标签'] });
    await mockTopicPages(page, entry.id);

    await page.goto('/');
    await page.getByText('标签测试').first().click();
    await expect(page.getByText('已有标签').first()).toBeVisible({ timeout: 5000 });

    const addTagBtn = page.getByText('+标签');
    if (await addTagBtn.isVisible({ timeout: 3000 })) {
      await addTagBtn.click();
      const tagInput = page.locator('input[placeholder*="标签"], input[placeholder*="tag"]').first();
      if (await tagInput.isVisible({ timeout: 2000 })) {
        await tagInput.fill('新标签');
        await tagInput.press('Enter');
        await expect(page.getByText('新标签')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('close detail panel with X button', async ({ page, request }) => {
    const entry = await seedEntry(request, { title: '关闭测试', content: '内容', subject: '测试' });
    await mockTopicPages(page, entry.id);

    await page.goto('/');
    await page.getByText('关闭测试').first().click();
    await expect(page.getByText('内容').first()).toBeVisible({ timeout: 5000 });

    const closeBtn = page.getByRole('button', { name: /×/ }).first();
    if (await closeBtn.isVisible({ timeout: 2000 })) {
      await closeBtn.click();
      await expect(page.getByText('选择一个知识点开始探索')).toBeVisible({ timeout: 5000 });
    }
  });
});

// ─── Smart Questions ────────────────────────────────────────

test.describe('Smart Questions', () => {
  test.beforeEach(async ({ request }) => { await clearAll(request); });
  test.afterEach(async ({ request }) => { await clearAll(request); });

  test('generate and display smart questions', async ({ page, request }) => {
    const entry = await seedEntry(request, { title: '问题生成', content: '内容', subject: '测试' });
    await mockTopicPages(page, entry.id, TOPIC_HTML);

    await page.route(`**/api/entries/${entry.id}/questions`, route => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          questions: [
            { question: '问题一：这是什么？', category: '基础' },
            { question: '问题二：为什么？', category: '分析' },
          ],
        }),
      });
    });

    await page.goto('/');
    await page.getByText('问题生成').first().click();

    // Switch to explore tab
    const exploreTab = page.getByText(/探索更多/);
    await expect(exploreTab).toBeVisible({ timeout: 5000 });
    await exploreTab.click();

    // Click generate smart questions button
    const genQBtn = page.getByRole('button', { name: /生成智能问题/ });
    await expect(genQBtn).toBeVisible({ timeout: 5000 });
    await genQBtn.click();

    await expect(page.getByText('问题一：这是什么？')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('问题二：为什么？')).toBeVisible();
  });

  test('click question to ask it', async ({ page, request }) => {
    const entry = await seedEntry(request, { title: '点击提问', content: '内容', subject: '测试' });
    await mockTopicPages(page, entry.id, TOPIC_HTML);

    await page.route(`**/api/entries/${entry.id}/questions`, route => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ questions: [{ question: '这个知识点的关键是什么？', category: '基础' }] }),
      });
    });
    await page.route(`**/api/entries/${entry.id}/ask`, route => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ answer: '关键在于理解核心概念', suggestedCards: [], sources: [] }),
      });
    });
    await page.route('**/api/topic-pages/*/qa-history', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await page.goto('/');
    await page.getByText('点击提问').first().click();

    const exploreTab = page.getByText(/探索更多/);
    await expect(exploreTab).toBeVisible({ timeout: 5000 });
    await exploreTab.click();

    const genQBtn = page.getByRole('button', { name: /生成智能问题/ });
    await expect(genQBtn).toBeVisible({ timeout: 5000 });
    await genQBtn.click();

    const questionText = page.getByText('这个知识点的关键是什么？');
    await expect(questionText).toBeVisible({ timeout: 10000 });

    // Click the question — the onClick on the parent div triggers handleAsk
    await questionText.click();

    // After clicking, a loading entry is added to qaHistory; wait for the answer to render
    await expect(page.getByText('关键在于理解核心概念')).toBeVisible({ timeout: 15000 });
  });
});

// ─── DeepAnalysis Child Management ──────────────────────────

test.describe('DeepAnalysis Interactions', () => {
  test.beforeEach(async ({ request }) => { await clearAll(request); });
  test.afterEach(async ({ request }) => { await clearAll(request); });

  test('manual add child form toggles and cancels', async ({ page, request }) => {
    const parent = await seedEntry(request, { title: 'DA父节点', content: '父内容', subject: '测试' });
    await mockTopicPages(page, parent.id);
    await page.route(`**/api/entries/${parent.id}/children`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ children: [] }) });
    });

    await page.goto(`/deep/${parent.id}`);
    await expect(page.getByRole('button', { name: /手动添加/ })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /手动添加/ }).click();

    const titleInput = page.locator('input[placeholder*="标题"]').first();
    await expect(titleInput).toBeVisible({ timeout: 3000 });
    await titleInput.fill('子知识点A');

    const contentInput = page.locator('textarea[placeholder*="内容"]').first();
    if (await contentInput.isVisible({ timeout: 2000 })) {
      await contentInput.fill('子内容A');
    }

    await page.getByRole('button', { name: /取消/ }).click();
    await expect(titleInput).not.toBeVisible({ timeout: 3000 });
  });

  test('AI expand button triggers expansion', async ({ page, request }) => {
    const parent = await seedEntry(request, { title: 'AI拆解测试', content: '拆解内容', subject: '测试' });
    await mockTopicPages(page, parent.id);
    await page.route(`**/api/entries/${parent.id}/children`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ children: [] }) });
    });

    await page.route(`**/api/entries/${parent.id}/expand`, route => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          children: [
            { id: 'c1', title: '子节点1', content: '内容1', tags: [] },
            { id: 'c2', title: '子节点2', content: '内容2', tags: [] },
          ],
        }),
      });
    });

    await page.goto(`/deep/${parent.id}`);
    const aiBtn = page.getByRole('button', { name: /AI自动拆解/ });
    await expect(aiBtn).toBeVisible({ timeout: 10000 });
    await aiBtn.click();

    await expect(page.getByText('子节点1')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('子节点2')).toBeVisible();
  });

  test('selecting child in sidebar shows EntryDetail', async ({ page, request }) => {
    const parent = await seedEntry(request, { title: 'DA选择子节点', content: '父', subject: '测试' });
    const child = await seedEntry(request, { title: '子节点Alpha', content: '子内容Alpha', subject: '测试', tags: ['标签A'] });

    await request.put(`/api/entries/${child.id}`, { data: { ...child, parent_id: parent.id } });

    await page.route(`**/api/entries/${parent.id}/children`, route => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ children: [{ id: child.id, title: '子节点Alpha', content: '子内容Alpha', subject: '测试', tags: ['标签A'] }] }),
      });
    });
    await mockTopicPages(page, child.id);

    await page.goto(`/deep/${parent.id}`);
    await expect(page.getByText('子节点Alpha')).toBeVisible({ timeout: 10000 });
    await page.getByText('子节点Alpha').click();

    await expect(page.getByText('子内容Alpha')).toBeVisible({ timeout: 10000 });
  });

  test('back to home link navigates to main page', async ({ page, request }) => {
    const parent = await seedEntry(request, { title: 'DA返回', content: '内容', subject: '测试' });
    await mockTopicPages(page, parent.id);
    await page.route(`**/api/entries/${parent.id}/children`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ children: [] }) });
    });

    await page.goto(`/deep/${parent.id}`);
    const backLink = page.getByText(/返回主页/);
    await expect(backLink).toBeVisible({ timeout: 10000 });
    await backLink.click();
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });

  test('export full deep analysis triggers download', async ({ page, request }) => {
    const parent = await seedEntry(request, { title: 'DA导出完整', content: '内容', subject: '测试' });

    await page.route(`**/api/entries/${parent.id}/topic-page/latest`, route => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ page: { id: 'tp-1', version: 1, html: TOPIC_HTML, qa_history: [], comments: [], included_qa_ids: [], created_at: '2026-01-01' } }),
      });
    });
    await page.route(`**/api/entries/${parent.id}/topic-pages`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pages: [{ version: 1, created_at: '2026-01-01' }] }) });
    });
    await page.route(`**/api/entries/${parent.id}/children`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ children: [] }) });
    });

    await page.goto(`/deep/${parent.id}`);
    await expect(page.getByText(/导出整体/)).toBeVisible({ timeout: 10000 });

    const downloadPromise = page.waitForEvent('download');
    await page.getByText(/导出整体/).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.html');
  });
});

// ─── Restructure Panel ──────────────────────────────────────

test.describe('Restructure Panel', () => {
  test.beforeEach(async ({ request }) => { await clearAll(request); });
  test.afterEach(async ({ request }) => { await clearAll(request); });

  test('restructure panel opens and shows execute button', async ({ page, request }) => {
    await seedEntry(request, { title: '重组测试1', content: '内容1', subject: '历史' });
    await seedEntry(request, { title: '重组测试2', content: '内容2', subject: '历史' });

    await page.goto('/');
    await expect(page.getByText(/2 个知识点/)).toBeVisible({ timeout: 5000 });

    const restructureBtn = page.getByText(/调整知识结构/);
    if (await restructureBtn.isVisible({ timeout: 3000 })) {
      await restructureBtn.click();
      await expect(page.getByRole('button', { name: /执行调整/ })).toBeVisible({ timeout: 5000 });
    }
  });
});

// ─── View Switching ─────────────────────────────────────────

test.describe('View Switching', () => {
  test.beforeEach(async ({ request }) => { await clearAll(request); });
  test.afterEach(async ({ request }) => { await clearAll(request); });

  test('switch between timeline and category views', async ({ page, request }) => {
    await seedEntry(request, { title: '视图切换', content: '内容', subject: '测试', tags: ['标签X'] });

    await page.goto('/');
    await expect(page.getByText('视图切换')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /分类/ }).click();
    await expect(page.getByText('视图切换')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /时间线/ }).click();
    await expect(page.getByText('视图切换')).toBeVisible({ timeout: 5000 });
  });

  test('discipline filter shows only matching entries', async ({ page, request }) => {
    await seedEntry(request, { title: '历史条目', content: '内容', subject: '历史' });
    await seedEntry(request, { title: '物理条目', content: '内容', subject: '物理' });

    await page.goto('/');
    await expect(page.getByText(/2 个知识点/)).toBeVisible({ timeout: 5000 });

    // Use first() to handle multiple matching elements in discipline filter
    const historyFilter = page.locator('span').filter({ hasText: /^历史$/ }).first();
    await expect(historyFilter).toBeVisible({ timeout: 3000 });
    await historyFilter.click();
    await expect(page.getByText('历史条目')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('物理条目')).not.toBeVisible({ timeout: 3000 });

    await page.getByText('全部').first().click();
    await expect(page.getByText('物理条目')).toBeVisible({ timeout: 3000 });
  });
});
