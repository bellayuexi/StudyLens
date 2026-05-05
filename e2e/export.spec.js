import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

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

const TOPIC_HTML = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>Test Topic</title>
<style>body{background:#0f1117;color:#e0e0e0}.card{background:#1a1e2e;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:20px}.highlight{background:linear-gradient(90deg,#764ba2,#667eea);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:bold}</style>
</head><body>
<h1>Test Export Topic</h1>
<div class="card"><p>Card content here</p></div>
<div class="highlight">Gradient text test</div>
<p>Normal paragraph text</p>
</body></html>`;

test.describe('Export HTML', () => {
  test.beforeEach(async ({ request }) => {
    await clearAll(request);
  });

  test.afterEach(async ({ request }) => {
    await clearAll(request);
  });

  test('EntryDetail export produces valid HTML with print CSS', async ({ page, request }) => {
    const entry = await seedEntry(request, {
      title: 'Export Test Entry',
      content: 'Testing export functionality',
      subject: '测试',
    });

    await page.route(`**/api/entries/${entry.id}/topic-page/latest`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ page: { id: 'tp-1', version: 1, html: TOPIC_HTML, qa_history: [], comments: [], included_qa_ids: [], created_at: '2026-01-01' } }),
      });
    });
    await page.route(`**/api/entries/${entry.id}/topic-pages`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pages: [{ version: 1, created_at: '2026-01-01' }] }) });
    });

    await page.goto('/');
    await page.click(`text=Export Test Entry`);
    await expect(page.getByText(/导出HTML/)).toBeVisible({ timeout: 10000 });

    const downloadPromise = page.waitForEvent('download');
    await page.click('text=导出HTML');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('Export Test Entry');
    expect(download.suggestedFilename()).toContain('.html');

    const filePath = await download.path();
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('<title>Export Test Entry');
    expect(content).toContain('@media print');
    expect(content).toContain('background: #fff !important');
    expect(content).toContain('-webkit-text-fill-color: initial !important');
    expect(content).toContain('Test Export Topic');
    expect(content).toContain('Card content here');
    expect(content).toContain('Gradient text test');
  });

  test('exported HTML print CSS makes text visible on white background', async ({ page, request, browser }) => {
    const entry = await seedEntry(request, {
      title: 'Print CSS Test',
      content: 'Testing print CSS',
      subject: '测试',
    });

    await page.route(`**/api/entries/${entry.id}/topic-page/latest`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ page: { id: 'tp-1', version: 1, html: TOPIC_HTML, qa_history: [], comments: [], included_qa_ids: [], created_at: '2026-01-01' } }),
      });
    });
    await page.route(`**/api/entries/${entry.id}/topic-pages`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pages: [{ version: 1, created_at: '2026-01-01' }] }) });
    });

    await page.goto('/');
    await page.click(`text=Print CSS Test`);
    await expect(page.getByText(/导出HTML/)).toBeVisible({ timeout: 10000 });

    const downloadPromise = page.waitForEvent('download');
    await page.click('text=导出HTML');
    const download = await downloadPromise;
    const filePath = await download.path();
    const content = fs.readFileSync(filePath, 'utf-8');

    const exportPage = await browser.newPage();
    await exportPage.setContent(content);
    await exportPage.emulateMedia({ media: 'print' });

    const bodyBg = await exportPage.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).toContain('255');

    const pColor = await exportPage.evaluate(() => {
      const p = document.querySelector('p');
      return p ? getComputedStyle(p).color : null;
    });
    if (pColor) {
      expect(pColor).not.toContain('224');
      expect(pColor).not.toContain('255, 255, 255');
    }

    const gradientFill = await exportPage.evaluate(() => {
      const el = document.querySelector('.highlight');
      return el ? getComputedStyle(el).webkitTextFillColor : null;
    });
    if (gradientFill) {
      expect(gradientFill).not.toBe('transparent');
    }

    await exportPage.close();
  });

  test('DeepAnalysis shows both export buttons', async ({ page, request }) => {
    const entry = await seedEntry(request, {
      title: 'DA Export Test',
      content: 'Deep analysis export',
      subject: '测试',
    });

    await page.route(`**/api/entries/${entry.id}/topic-page/latest`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ page: { id: 'tp-1', version: 1, html: TOPIC_HTML, qa_history: [], comments: [], included_qa_ids: [], created_at: '2026-01-01' } }),
      });
    });
    await page.route(`**/api/entries/${entry.id}/topic-pages`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pages: [{ version: 1, created_at: '2026-01-01' }] }) });
    });
    await page.route(`**/api/entries/${entry.id}/children`, route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ children: [] }) });
    });

    await page.goto(`/deep/${entry.id}`);

    await expect(page.getByText(/导出当前页面/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/导出整体/)).toBeVisible();
  });
});
