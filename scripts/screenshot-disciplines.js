const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));
  
  // Screenshot 1: default "全部" view
  await page.screenshot({ path: 'screenshots/discipline-all.png', clip: { x: 0, y: 0, width: 400, height: 900 } });
  
  // Click "历史" discipline
  await page.evaluate(() => {
    const spans = document.querySelectorAll('span');
    for (const s of spans) {
      if (s.textContent.trim() === '历史') { s.click(); break; }
    }
  });
  await new Promise(r => setTimeout(r, 1000));
  
  // Screenshot 2: "历史" selected with sub-categories
  await page.screenshot({ path: 'screenshots/discipline-history.png', clip: { x: 0, y: 0, width: 400, height: 900 } });
  
  await browser.close();
  console.log('Screenshots saved');
})();
