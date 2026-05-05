#!/usr/bin/env node
const path = require('path');
const PORT = process.env.PORT || 3000;
process.env.STUDYLENS_DATA_DIR = process.env.STUDYLENS_DATA_DIR || path.join(process.cwd(), 'wiki');
require('../server/index.js');
