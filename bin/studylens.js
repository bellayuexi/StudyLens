#!/usr/bin/env node
const path = require('path');
const dataDir = process.env.STUDYLENS_DATA_DIR || path.join(process.cwd(), 'studylens-data');
process.env.STUDYLENS_WIKI_DIR = process.env.STUDYLENS_WIKI_DIR || dataDir;
const app = require('../server/index.js');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`StudyLens server running on http://localhost:${PORT}`));
