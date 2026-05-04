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

function mockTopicPages(page, entryId) {
  page.route(`**/api/entries/${entryId}/topic-page/latest`, route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ page: null }) });
  });
  page.route(`**/api/entries/${entryId}/topic-pages`, route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pages: [] }) });
  });
}

async function openExploreAndGenerate(page, entryText) {
  await page.getByText(entryText).first().click();
  await page.getByText('探索更多').first().click();
  const genBtn = page.getByText('生成智能问题').first();
  await expect(genBtn).toBeVisible({ timeout: 10000 });
  await genBtn.click();
}

test.describe('Async State Isolation', () => {
  let entryA, entryB;

  test.beforeEach(async ({ request }) => {
    await clearAll(request);
    entryA = await seedEntry(request, { title: '秦朝统一', content: '公元前221年秦始皇统一六国', subject: '历史', tags: ['秦朝'] });
    entryB = await seedEntry(request, { title: '光合作用', content: '植物利用光能合成有机物', subject: '生物', tags: ['生物'] });
  });

  test.afterEach(async ({ request }) => {
    await clearAll(request);
  });

  test('questions generated for entry A do not appear on entry B', async ({ page }) => {
    const questionsA = [
      { id: 'q1', question: '秦朝统一的意义是什么？', category: '概念' },
      { id: 'q2', question: '秦始皇采取了哪些措施？', category: '原因' },
    ];

    await page.route(`**/api/entries/${entryA.id}/questions`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ questions: questionsA }) });
    });
    await page.route(`**/api/entries/${entryB.id}/questions`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ questions: [{ id: 'q3', question: '光合作用的产物是什么？', category: '概念' }] }) });
    });
    mockTopicPages(page, entryA.id);
    mockTopicPages(page, entryB.id);

    await page.goto('/');

    // Click entry A, switch to explore tab, generate questions
    await openExploreAndGenerate(page, '秦朝统一');
    await expect(page.getByText('秦朝统一的意义是什么？')).toBeVisible();

    // Switch to entry B
    await page.getByText('光合作用').first().click();
    // Entry A's questions should not be visible
    await expect(page.getByText('秦朝统一的意义是什么？')).not.toBeVisible();
  });

  test('questions for entry A persist after switching to B and back', async ({ page }) => {
    const questionsA = [
      { id: 'q1', question: '秦朝的统一意义', category: '概念' },
    ];

    await page.route(`**/api/entries/${entryA.id}/questions`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ questions: questionsA }) });
    });
    mockTopicPages(page, entryA.id);
    mockTopicPages(page, entryB.id);

    await page.goto('/');

    // Open entry A, go to explore tab, generate questions
    await openExploreAndGenerate(page, '秦朝统一');
    await expect(page.getByText('秦朝的统一意义')).toBeVisible();

    // Switch to entry B
    await page.getByText('光合作用').first().click();
    await expect(page.getByText('秦朝的统一意义')).not.toBeVisible();

    // Switch back to entry A — questions should be restored from cache
    await page.getByText('秦朝统一').first().click();
    await page.getByText('探索更多').first().click();
    await expect(page.getByText('秦朝的统一意义')).toBeVisible();
  });

  test('QA answer for entry A does not leak to entry B', async ({ page }) => {
    const questionsA = [
      { id: 'q1', question: '秦朝问题', category: '概念' },
    ];

    await page.route(`**/api/entries/${entryA.id}/questions`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ questions: questionsA }) });
    });
    await page.route(`**/api/entries/${entryA.id}/ask`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: '秦朝统一了文字和度量衡', suggestedCards: [] }) });
    });
    await page.route(`**/api/topic-pages/*/qa-history`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    mockTopicPages(page, entryA.id);
    mockTopicPages(page, entryB.id);

    await page.goto('/');

    // Open A, generate questions, answer one
    await openExploreAndGenerate(page, '秦朝统一');
    await expect(page.getByText('秦朝问题')).toBeVisible();

    // Click the question text to trigger answer
    await page.getByText('秦朝问题').first().click();
    await expect(page.getByText('秦朝统一了文字和度量衡').first()).toBeVisible({ timeout: 10000 });

    // Switch to entry B — answer should not be visible
    await page.getByText('光合作用').first().click();
    await expect(page.getByText('秦朝统一了文字和度量衡')).not.toBeVisible();
  });

  test('slow async response for entry A is discarded after switching to entry B', async ({ page }) => {
    let resolveQuestions;
    const slowPromise = new Promise(resolve => { resolveQuestions = resolve; });

    await page.route(`**/api/entries/${entryA.id}/questions`, async route => {
      await slowPromise;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ questions: [{ id: 'q1', question: '迟到的问题', category: '概念' }] }) });
    });
    mockTopicPages(page, entryA.id);
    mockTopicPages(page, entryB.id);

    await page.goto('/');

    // Open entry A, start generating questions (will be slow)
    await openExploreAndGenerate(page, '秦朝统一');

    // Quickly switch to entry B before response arrives
    await page.getByText('光合作用').first().click();

    // Now resolve the slow response
    resolveQuestions();
    await page.waitForTimeout(500);

    // The late-arriving questions for A should NOT appear on B's view
    await expect(page.getByText('迟到的问题')).not.toBeVisible();
  });

  test('topic page content stays with correct entry after switching', async ({ page }) => {
    await page.route(`**/api/entries/${entryA.id}/topic-page/latest`, route => {
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ page: { html: '<h1>秦朝专题</h1><p>秦朝的历史</p>', id: 'tp1', version: 1, qa_history: [], comments: [], included_qa_ids: [] } }) });
    });
    await page.route(`**/api/entries/${entryB.id}/topic-page/latest`, route => {
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ page: { html: '<h1>光合作用专题</h1><p>光合作用的过程</p>', id: 'tp2', version: 1, qa_history: [], comments: [], included_qa_ids: [] } }) });
    });
    await page.route(`**/api/entries/${entryA.id}/topic-pages`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pages: [{ version: 1 }] }) });
    });
    await page.route(`**/api/entries/${entryB.id}/topic-pages`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pages: [{ version: 1 }] }) });
    });

    await page.goto('/');

    // Open entry A — should show A's topic page
    await page.getByText('秦朝统一').first().click();
    const iframe = page.frameLocator('iframe').first();
    await expect(iframe.locator('body')).toContainText('秦朝的历史', { timeout: 10000 });

    // Switch to entry B — should show B's topic page
    await page.getByText('光合作用').first().click();
    await expect(iframe.locator('body')).toContainText('光合作用的过程', { timeout: 10000 });
    await expect(iframe.locator('body')).not.toContainText('秦朝的历史');
  });
});
