import { test, expect } from '@playwright/test';

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
    await expect(page.getByText('默认 Prompt')).toBeVisible();
    // Close settings via back button
    await page.getByRole('button', { name: /返回/ }).click();
    // Verify we're back to main view
    await expect(page.getByText('选择一个知识点开始探索')).toBeVisible();
  });

  test('settings shows default prompts section', async ({ page }) => {
    await openSettings(page);
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
});

test.describe('Navigation', () => {
  test('switching views between timeline and category', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /时间线/ }).click();
    await page.getByRole('button', { name: /分类/ }).click();
    await expect(page.getByText(/\d+ 个知识点/)).toBeVisible();
  });
});
