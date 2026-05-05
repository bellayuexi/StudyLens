import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDataDir = path.join(__dirname, '..', 'data-test');
const testWikiDir = path.join(__dirname, '..', 'wiki-test');

fs.mkdirSync(testDataDir, { recursive: true });
fs.mkdirSync(testWikiDir, { recursive: true });

process.env.STUDYLENS_DB_PATH = path.join(testDataDir, 'studylens.db');
process.env.STUDYLENS_WIKI_DIR = testWikiDir;
