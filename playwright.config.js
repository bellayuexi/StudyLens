const { defineConfig } = require('@playwright/test');
const path = require('path');

const testDataDir = path.join(__dirname, 'data-test');
const testWikiDir = path.join(__dirname, 'wiki-test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3099',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'node server/index.js',
    port: 3099,
    reuseExistingServer: false,
    env: {
      PORT: '3099',
      STUDYGRAPH_DB_PATH: path.join(testDataDir, 'e2e.db'),
      STUDYGRAPH_WIKI_DIR: testWikiDir,
      STUDYGRAPH_TEST_MODE: '1',
    },
  },
});
