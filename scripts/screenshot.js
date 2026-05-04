const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Click the subject filter by evaluating in-page JS
  await page.evaluate(() => {
    const spans = document.querySelectorAll('span');
    for (const s of spans) {
      if (s.textContent.trim() === '历史-北宋') {
        s.click();
        break;
      }
    }
  });
  await new Promise(r => setTimeout(r, 1500));

  // Screenshot the sidebar
  await page.screenshot({ path: 'screenshots/sidebar-beisong-filtered.png', clip: { x: 0, y: 0, width: 320, height: 900 } });

  await browser.close();
  console.log('Screenshot saved');
})();
