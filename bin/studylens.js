#!/usr/bin/env node
const path = require('path');
const os = require('os');
const dataDir = process.env.STUDYLENS_DATA_DIR || path.join(os.homedir(), '.studylens');
process.env.STUDYLENS_WIKI_DIR = process.env.STUDYLENS_WIKI_DIR || path.join(dataDir, 'wiki');
process.env.STUDYLENS_CONFIG_DIR = process.env.STUDYLENS_CONFIG_DIR || dataDir;
process.env.STUDYLENS_UPLOAD_DIR = process.env.STUDYLENS_UPLOAD_DIR || path.join(dataDir, 'uploads');
process.env.STUDYLENS_LOG_DIR = process.env.STUDYLENS_LOG_DIR || path.join(dataDir, 'logs');
const app = require('../server/index.js');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`StudyLens server running on http://localhost:${PORT}`));
