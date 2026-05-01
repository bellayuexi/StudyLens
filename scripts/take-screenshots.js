const puppeteer = require('puppeteer');
const path = require('path');
const { execSync } = require('child_process');

const BASE_URL = process.env.STUDYGRAPH_URL || 'http://localhost:5173';
const CHAT_ID = 'oc_f2fcef2d97444f7b7861abadcb2d98d3';
const OUT_DIR = path.join(__dirname, '..', 'screenshots');
const fs = require('fs');

const VIEWS = [
  { name: 'graph', label: '知识图谱', wait: 3000 },
  { name: 'timeline', label: '时间线', wait: 1500 },
  { name: 'category', label: '分类', wait: 1500 },
];

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1400, height: 900 },
  });

  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  const files = [];

  for (const view of VIEWS) {
    console.log(`Capturing ${view.name}...`);
    // Click the view tab button by matching its text content
    const clicked = await page.evaluate((label) => {
      const buttons = [...document.querySelectorAll('button')];
      const btn = buttons.find(b => b.textContent.includes(label));
      if (btn) { btn.click(); return true; }
      return false;
    }, view.label);
    if (clicked) await new Promise(r => setTimeout(r, view.wait));

    const filePath = path.join(OUT_DIR, `${view.name}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    files.push(filePath);
    console.log(`  Saved: ${filePath}`);
  }

  await browser.close();

  // Send via Feishu
  const sendToFeishu = process.argv.includes('--send');
  if (sendToFeishu) {
    for (const f of files) {
      const name = path.basename(f, '.png');
      try {
        execSync(`lark-cli im +messages-send --as bot --chat-id ${CHAT_ID} --image "./${path.basename(f)}"`, { stdio: 'inherit', cwd: OUT_DIR });
        console.log(`  Sent ${name} to Feishu`);
      } catch (err) {
        console.error(`  Failed to send ${name}: ${err.message}`);
      }
    }
  }

  console.log('Done.');
  return files;
}

run().catch(err => { console.error(err); process.exit(1); });
