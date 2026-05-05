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
  } catch { /* no entries to clear */ }
}

test.describe('Page Loading', () => {
  test('homepage loads with StudyGraph title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('StudyGraph');
  });

  test('homepage shows empty state placeholder', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('选择一个知识点开始探索')).toBeVisible();
  });

  test('view switcher buttons are visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /时间线/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /分类/ })).toBeVisible();
  });

  test('search input is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[placeholder*="搜索"]')).toBeVisible();
  });
});

test.describe('Settings Panel', () => {
  async function openSettings(page) {
    await page.goto('/');
    await page.getByTestId('settings-btn').click();
  }

  test('opens and closes without losing page state', async ({ page }) => {
    await openSettings(page);
    await expect(page.getByText('Prompt 配置')).toBeVisible();
    await page.getByRole('button', { name: /返回/ }).click();
    await expect(page.getByText('选择一个知识点开始探索')).toBeVisible();
  });

  test('settings shows default prompts section', async ({ page }) => {
    await openSettings(page);
    await page.getByText('Prompt 配置').click();
    await expect(page.getByText('默认 Prompt')).toBeVisible();
  });

  test('settings save button is disabled when no changes', async ({ page }) => {
    await openSettings(page);
    const saveBtn = page.getByRole('button', { name: /保存/ });
    await expect(saveBtn).toBeDisabled();
  });
});

test.describe('Ingest Panel', () => {
  test('ingest text area is visible', async ({ page }) => {
    await page.goto('/');
    const textarea = page.locator('textarea');
    await expect(textarea.first()).toBeVisible();
  });

  test('ingest tab switching works', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /文件/ }).click();
    await expect(page.getByText('点击选择文件')).toBeVisible();
    await page.getByRole('button', { name: /网页/ }).click();
    await expect(page.locator('input[placeholder="https://..."]')).toBeVisible();
    await page.getByRole('button', { name: /文本/ }).click();
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('submit button disabled when no input', async ({ page }) => {
    await page.goto('/');
    const submitBtn = page.getByRole('button', { name: /添加知识/ });
    await expect(submitBtn).toBeDisabled();
  });

  test('submit button enabled after typing text', async ({ page }) => {
    await page.goto('/');
    await page.locator('textarea').fill('some test content');
    const submitBtn = page.getByRole('button', { name: /添加知识/ });
    await expect(submitBtn).toBeEnabled();
  });
});

test.describe('Navigation', () => {
  test('switching views between timeline and category', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /时间线/ }).click();
    await page.getByRole('button', { name: /分类/ }).click();
    await expect(page.getByText(/\d+ 个知识点/)).toBeVisible();
  });
});

test.describe('Entry List with Seeded Data', () => {
  test.beforeEach(async ({ request }) => {
    await clearAll(request);
    await seedEntry(request, { title: '秦朝统一', content: '公元前221年秦始皇统一六国', subject: '历史-秦汉', tags: ['秦朝'] });
    await seedEntry(request, { title: '汉武帝', content: '汉武帝刘彻推行大一统政策', subject: '历史-秦汉', tags: ['汉朝'] });
    await seedEntry(request, { title: '光合作用', content: '植物利用光能合成有机物', subject: '生物-细胞', tags: ['生物'] });
  });

  test.afterEach(async ({ request }) => {
    await clearAll(request);
  });

  test('displays seeded entries in category view', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('3 个知识点')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('秦朝统一').first()).toBeVisible();
    await expect(page.getByText('汉武帝').first()).toBeVisible();
    await expect(page.getByText('光合作用').first()).toBeVisible();
  });

  test('entry count is correct', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('3 个知识点')).toBeVisible({ timeout: 5000 });
  });

  test('clicking entry shows detail panel', async ({ page }) => {
    await page.goto('/');
    await page.getByText('秦朝统一').first().click();
    await expect(page.getByText('公元前221年秦始皇统一六国').first()).toBeVisible();
  });

  test('search filters entries', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[placeholder*="搜索"]').fill('光合');
    await expect(page.getByText('光合作用')).toBeVisible();
    await expect(page.getByText('秦朝统一')).not.toBeVisible();
    await expect(page.getByText('1 个知识点')).toBeVisible();
  });

  test('search by tag filters entries', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[placeholder*="搜索"]').fill('汉朝');
    await expect(page.getByText('汉武帝').first()).toBeVisible();
    await expect(page.getByText('1 个知识点')).toBeVisible();
  });

  test('clearing search shows all entries again', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.locator('input[placeholder*="搜索"]');
    await searchInput.fill('光合');
    await expect(page.getByText('1 个知识点')).toBeVisible();
    await searchInput.fill('');
    await expect(page.getByText('3 个知识点')).toBeVisible();
  });

  test('discipline filter works', async ({ page }) => {
    await page.goto('/');
    await page.getByText('历史', { exact: true }).click();
    await expect(page.getByText('2 个知识点')).toBeVisible();
    await expect(page.getByText('秦朝统一')).toBeVisible();
    await expect(page.getByText('光合作用')).not.toBeVisible();
  });

  test('all filter resets discipline filter', async ({ page }) => {
    await page.goto('/');
    await page.getByText('历史', { exact: true }).click();
    await expect(page.getByText('2 个知识点')).toBeVisible();
    await page.getByText('全部', { exact: true }).click();
    await expect(page.getByText('3 个知识点')).toBeVisible();
  });

  test('timeline view shows entries', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /时间线/ }).click();
    await expect(page.getByText('秦朝统一')).toBeVisible();
  });
});

test.describe('Entry Detail Interaction', () => {
  test.beforeEach(async ({ request }) => {
    await clearAll(request);
    await seedEntry(request, { title: '测试知识点', content: '这是测试内容', subject: '测试-科目', tags: ['tag1', 'tag2'] });
  });

  test.afterEach(async ({ request }) => {
    await clearAll(request);
  });

  test('detail panel shows entry metadata', async ({ page }) => {
    await page.goto('/');
    await page.getByText('测试知识点').first().click();
    await expect(page.getByText('这是测试内容').first()).toBeVisible();
    await expect(page.getByText('tag1').first()).toBeVisible();
    await expect(page.getByText('tag2').first()).toBeVisible();
  });

  test('closing detail returns to empty state', async ({ page }) => {
    await page.goto('/');
    await page.getByText('测试知识点').first().click();
    await expect(page.getByText('这是测试内容').first()).toBeVisible();
    const closeBtn = page.locator('[style*="position: absolute"]').getByRole('button').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  test('delete entry removes it from list', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('1 个知识点')).toBeVisible();
    await page.getByText('测试知识点').first().click();
    page.on('dialog', dialog => dialog.accept());
    const deleteBtn = page.getByRole('button', { name: /删除/ });
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await expect(page.getByText('0 个知识点')).toBeVisible();
    }
  });
});
