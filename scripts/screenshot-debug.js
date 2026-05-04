const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));
  
  // Check if badges exist in DOM
  const badgeInfo = await page.evaluate(() => {
    const items = document.querySelectorAll('span');
    const badges = [];
    for (const s of items) {
      const t = s.textContent.trim();
      if (t === '专题' || t === '问答' || t === '深入') {
        const rect = s.getBoundingClientRect();
        badges.push({ text: t, visible: rect.width > 0, x: rect.x, y: rect.y, w: rect.width, h: rect.height });
      }
    }
    return badges;
  });
  console.log('Badges found:', JSON.stringify(badgeInfo, null, 2));
  
  // Take full sidebar screenshot
  await page.screenshot({ path: 'screenshots/sidebar-debug.png', clip: { x: 0, y: 0, width: 400, height: 900 } });
  await browser.close();
  console.log('Screenshot saved');
})();
