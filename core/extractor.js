const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

async function extractFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buf = fs.readFileSync(filePath);

  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buf);
    return data.text;
  }

  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value;
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const XLSX = require('xlsx');
    const wb = XLSX.read(buf);
    const texts = [];
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      texts.push(`[${name}]\n${XLSX.utils.sheet_to_csv(sheet)}`);
    }
    return texts.join('\n\n');
  }

  if (ext === '.txt' || ext === '.md') {
    return buf.toString('utf-8');
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

function fetchUrl(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    mod.get(url, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0 StudyGraph/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    }).on('error', reject);
  });
}

async function extractFromUrl(urlStr) {
  const html = await fetchUrl(urlStr);
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);

  $('script, style, nav, footer, header, iframe, noscript').remove();

  const article = $('article').length ? $('article') : $('main').length ? $('main') : $('body');
  const text = article.text().replace(/\s+/g, ' ').trim();

  if (text.length < 50) throw new Error('Could not extract meaningful text from URL');
  return text.slice(0, 15000);
}

module.exports = { extractFromFile, extractFromUrl };
