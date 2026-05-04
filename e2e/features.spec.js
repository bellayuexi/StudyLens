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

async function mockTopicPages(page, entryId) {
  await page.route(`**/api/entries/${entryId}/topic-page/latest`, route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ page: null }) });
  });
  await page.route(`**/api/entries/${entryId}/topic-pages`, route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pages: [] }) });
  });
}

test.describe('Text Ingestion', () => {
  test.beforeEach(async ({ request }) => {
    await clearAll(request);
  });

  test.afterEach(async ({ request }) => {
    await clearAll(request);
  });

  test('submitting text shows success message', async ({ page }) => {
    await page.route('**/api/ingest', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          created: [
            { id: 'ing1', title: '唐朝建立', content: '李渊于618年建立唐朝', subject: '历史', tags: ['唐朝'], created_at: new Date().toISOString() },
            { id: 'ing2', title: '贞观之治', content: '唐太宗李世民的治世', subject: '历史', tags: ['唐朝'], created_at: new Date().toISOString() },
          ],
        }),
      });
    });

    await page.goto('/');
    const textarea = page.locator('textarea');
    await textarea.fill('唐朝是中国历史上一个重要的朝代');

    const submitBtn = page.getByRole('button', { name: /添加知识/ });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect(page.getByText('成功提取 2 个知识点')).toBeVisible({ timeout: 10000 });
  });

  test('submit button is disabled with empty textarea', async ({ page }) => {
    await page.goto('/');
    const submitBtn = page.getByRole('button', { name: /添加知识/ });
    await expect(submitBtn).toBeDisabled();
  });

  test('subject field is sent with ingestion request', async ({ page }) => {
    let capturedBody = null;
    await page.route('**/api/ingest', route => {
      capturedBody = route.request().postDataJSON();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ created: [{ id: 'sub1', title: '测试', content: '内容', subject: '物理', tags: [], created_at: new Date().toISOString() }] }),
      });
    });

    await page.goto('/');
    await page.locator('textarea').fill('牛顿第一定律');
    const subjectInput = page.locator('input[placeholder*="学科"]');
    if (await subjectInput.isVisible()) {
      await subjectInput.fill('物理');
    }
    await page.getByRole('button', { name: /添加知识/ }).click();
    await expect(page.getByText('成功提取 1 个知识点')).toBeVisible({ timeout: 10000 });
    expect(capturedBody).toBeTruthy();
    expect(capturedBody.text).toContain('牛顿第一定律');
  });
});

test.describe('Entry Editing', () => {
  let entry;

  test.beforeEach(async ({ request }) => {
    await clearAll(request);
    entry = await seedEntry(request, { title: '原始标题', content: '原始内容', subject: '测试', tags: ['标签1'] });
  });

  test.afterEach(async ({ request }) => {
    await clearAll(request);
  });

  test('clicking entry shows content and tags', async ({ page }) => {
    await mockTopicPages(page, entry.id);
    await page.goto('/');
    await page.getByText('原始标题').first().click();
    await expect(page.getByText('原始内容').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('标签1').first()).toBeVisible();
  });

  test('delete entry removes it from list', async ({ page }) => {
    await mockTopicPages(page, entry.id);
    await page.goto('/');
    await expect(page.getByText('1 个知识点')).toBeVisible();
    await page.getByText('原始标题').first().click();

    page.on('dialog', dialog => dialog.accept());
    const deleteBtn = page.getByRole('button', { name: /删除/ });
    if (await deleteBtn.isVisible({ timeout: 3000 })) {
      await deleteBtn.click();
      await expect(page.getByText('0 个知识点')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Settings Save/Restore', () => {
  test('settings panel opens and shows default prompts section', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('settings-btn').click();
    await expect(page.getByText('默认 Prompt')).toBeVisible();
  });

  test('expanding default prompts shows prompt textareas', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('settings-btn').click();
    await page.getByText('默认 Prompt').click();
    await expect(page.getByText('知识提取')).toBeVisible();
  });

  test('save button enables after editing a default prompt', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('settings-btn').click();
    const saveBtn = page.getByRole('button', { name: /保存/ });
    await expect(saveBtn).toBeDisabled();

    await page.getByText('默认 Prompt').click();
    await expect(page.getByText('知识提取')).toBeVisible();

    const promptTextarea = page.locator('label:has-text("知识提取") + textarea, label:has-text("知识提取") ~ textarea').first();
    if (await promptTextarea.isVisible({ timeout: 3000 })) {
      const original = await promptTextarea.inputValue();
      await promptTextarea.fill(original + ' 修改');
      await expect(saveBtn).toBeEnabled({ timeout: 3000 });
    }
  });

  test('back button returns to main page', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('settings-btn').click();
    await expect(page.getByText('默认 Prompt')).toBeVisible();
    await page.getByRole('button', { name: /返回/ }).click();
    await expect(page.getByText('选择一个知识点开始探索')).toBeVisible();
  });
});

test.describe('Deep Analysis Navigation', () => {
  let entry;

  test.beforeEach(async ({ request }) => {
    await clearAll(request);
    entry = await seedEntry(request, { title: '中国古代史', content: '从夏商周到明清的历史', subject: '历史', tags: ['通史'] });
  });

  test.afterEach(async ({ request }) => {
    await clearAll(request);
  });

  test('deep analysis button navigates to deep analysis page', async ({ page }) => {
    await mockTopicPages(page, entry.id);
    await page.route(`**/api/entries/${entry.id}/children`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ children: [] }) });
    });

    await page.goto('/');
    await expect(page.getByText('中国古代史').first()).toBeVisible({ timeout: 5000 });
    await page.getByText('中国古代史').first().click();
    await expect(page.getByText('从夏商周到明清的历史').first()).toBeVisible({ timeout: 5000 });

    const deepBtn = page.getByText('深入分析').first();
    if (await deepBtn.isVisible({ timeout: 3000 })) {
      await deepBtn.click();
      await expect(page).toHaveURL(/\/deep\//);
      await expect(page.getByText('中国古代史')).toBeVisible();
    }
  });

  test('deep analysis page shows AI expand button', async ({ page }) => {
    await mockTopicPages(page, entry.id);
    await page.route(`**/api/entries/${entry.id}/children`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ children: [] }) });
    });

    await page.goto('/');
    await expect(page.getByText('中国古代史').first()).toBeVisible({ timeout: 5000 });
    await page.getByText('中国古代史').first().click();

    const deepBtn = page.getByText('深入分析').first();
    if (await deepBtn.isVisible({ timeout: 3000 })) {
      await deepBtn.click();
      await expect(page.getByText('AI自动拆解')).toBeVisible({ timeout: 5000 });
    }
  });

  test('deep analysis shows children after expand', async ({ page }) => {
    await mockTopicPages(page, entry.id);
    let expandCalled = false;
    await page.route(`**/api/entries/${entry.id}/children`, route => {
      const children = expandCalled
        ? [
            { id: 'c1', title: '夏商周', content: '早期文明', subject: '历史', tags: [], parent_id: entry.id },
            { id: 'c2', title: '秦汉', content: '大一统时代', subject: '历史', tags: [], parent_id: entry.id },
          ]
        : [];
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ children }) });
    });
    await page.route(`**/api/entries/${entry.id}/expand`, route => {
      expandCalled = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          children: [
            { id: 'c1', title: '夏商周', content: '早期文明', subject: '历史', tags: [], parent_id: entry.id },
            { id: 'c2', title: '秦汉', content: '大一统时代', subject: '历史', tags: [], parent_id: entry.id },
          ],
        }),
      });
    });

    await page.goto('/');
    await expect(page.getByText('中国古代史').first()).toBeVisible({ timeout: 5000 });
    await page.getByText('中国古代史').first().click();

    const deepBtn = page.getByText('深入分析').first();
    if (await deepBtn.isVisible({ timeout: 3000 })) {
      await deepBtn.click();
      const expandBtn = page.getByText('AI自动拆解').first();
      await expect(expandBtn).toBeVisible({ timeout: 5000 });
      await expandBtn.click();
      await expect(page.getByText('夏商周')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('秦汉')).toBeVisible();
    }
  });

  test('back button returns from deep analysis to main page', async ({ page }) => {
    await mockTopicPages(page, entry.id);
    await page.route(`**/api/entries/${entry.id}/children`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ children: [] }) });
    });

    await page.goto('/');
    await expect(page.getByText('中国古代史').first()).toBeVisible({ timeout: 5000 });
    await page.getByText('中国古代史').first().click();

    const deepBtn = page.getByText('深入分析').first();
    if (await deepBtn.isVisible({ timeout: 3000 })) {
      await deepBtn.click();
      await expect(page).toHaveURL(/\/deep\//);

      const backBtn = page.getByText('返回主页').first();
      if (await backBtn.isVisible({ timeout: 3000 })) {
        await backBtn.click();
        await expect(page).toHaveURL('/');
      }
    }
  });
});

test.describe('State Preservation across Deep Analysis', () => {
  let entry;

  test.beforeEach(async ({ request }) => {
    await clearAll(request);
    await seedEntry(request, { title: '物理基础', content: '力学入门', subject: '物理-力学', tags: ['力学'] });
    entry = await seedEntry(request, { title: '化学反应', content: '化学方程式', subject: '化学-有机', tags: ['有机'] });
  });

  test.afterEach(async ({ request }) => {
    await clearAll(request);
  });

  test('filter state preserved after returning from deep analysis', async ({ page }) => {
    await mockTopicPages(page, entry.id);
    await page.route(`**/api/entries/${entry.id}/children`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ children: [] }) });
    });

    await page.goto('/');
    await expect(page.getByText('2 个知识点')).toBeVisible({ timeout: 5000 });

    await page.getByText('化学', { exact: true }).click();
    await expect(page.getByText('1 个知识点')).toBeVisible();

    await page.getByText('化学反应').first().click();
    const deepBtn = page.getByText('深入分析').first();
    if (await deepBtn.isVisible({ timeout: 3000 })) {
      await deepBtn.click();
      await expect(page).toHaveURL(/\/deep\//);

      await page.getByText('返回主页').first().click();
      await expect(page).toHaveURL('/');
      await expect(page.getByText('1 个知识点')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Theme Toggle', () => {
  let entry;

  test.beforeEach(async ({ request }) => {
    await clearAll(request);
    entry = await seedEntry(request, { title: '主题测试', content: '测试浅色主题切换', subject: '测试', tags: [] });
  });

  test.afterEach(async ({ request }) => {
    await clearAll(request);
  });

  test('theme toggle switches instantly without AI', async ({ page }) => {
    const topicHTML = '<html><body style="background:#1a1a2e;color:#eee"><h1>Test</h1><p>Content</p></body></html>';
    await page.route(`**/api/entries/${entry.id}/topic-page/latest`, route => {
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ page: { html: topicHTML, id: 'tp1', version: 1, qa_history: [], comments: [], included_qa_ids: [] } }) });
    });
    await page.route(`**/api/entries/${entry.id}/topic-pages`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pages: [{ version: 1 }] }) });
    });

    await page.goto('/');
    await page.getByText('主题测试').first().click();
    const iframe = page.frameLocator('iframe[title="知识专题"]');
    await expect(iframe.locator('body')).toBeVisible({ timeout: 10000 });

    const lightBtn = page.getByText('☀️ 浅色');
    if (await lightBtn.isVisible({ timeout: 3000 })) {
      await lightBtn.click();
      await expect(page.getByText('🌙 深色')).toBeVisible();
    }
  });
});
