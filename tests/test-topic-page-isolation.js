const storage = require('../core/wiki-storage');
const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

console.log('Topic Page Isolation Tests\n');

// Create two test entries
const entryA = storage.addEntry({ title: 'Test Entry A', content: 'Content A', subject: 'test', tags: ['test'] });
const entryB = storage.addEntry({ title: 'Test Entry B', content: 'Content B', subject: 'test', tags: ['test'] });

// Test 1: Save topic page for entry A with qa_history
const pageA = storage.saveTopicPage(entryA.id, '<h1>Topic A</h1>', [{ question: 'Q about A', answer: 'A about A' }], []);
test('saveTopicPage returns correct entry_id for A', () => {
  assert.strictEqual(pageA.entry_id, entryA.id);
});

// Test 2: Save topic page for entry B with different qa_history
const pageB = storage.saveTopicPage(entryB.id, '<h1>Topic B</h1>', [{ question: 'Q about B', answer: 'A about B' }], []);
test('saveTopicPage returns correct entry_id for B', () => {
  assert.strictEqual(pageB.entry_id, entryB.id);
});

// Test 3: Loading topic page for A should only return A's data
const latestA = storage.getLatestTopicPage(entryA.id);
test('getLatestTopicPage for A returns A data', () => {
  assert.strictEqual(latestA.entry_id, entryA.id);
  assert.strictEqual(latestA.qa_history[0].question, 'Q about A');
});

// Test 4: Loading topic page for B should only return B's data
const latestB = storage.getLatestTopicPage(entryB.id);
test('getLatestTopicPage for B returns B data', () => {
  assert.strictEqual(latestB.entry_id, entryB.id);
  assert.strictEqual(latestB.qa_history[0].question, 'Q about B');
});

// Test 5: Update qa_history for A should not affect B
storage.updateTopicPageQaHistory(pageA.id, [{ question: 'Updated Q for A', answer: 'Updated A for A' }]);
const updatedA = storage.getLatestTopicPage(entryA.id);
const unchangedB = storage.getLatestTopicPage(entryB.id);
test('updateTopicPageQaHistory only affects target page', () => {
  assert.strictEqual(updatedA.qa_history[0].question, 'Updated Q for A');
  assert.strictEqual(unchangedB.qa_history[0].question, 'Q about B');
});

// Test 6: getTopicPages should not return pages from other entries
const pagesA = storage.getTopicPages(entryA.id);
test('getTopicPages for A only returns A pages', () => {
  assert.ok(pagesA.every(p => p.entry_id === entryA.id), 'All pages should belong to entry A');
});

// Test 7: Save multiple versions and verify isolation
const pageA2 = storage.saveTopicPage(entryA.id, '<h1>Topic A v2</h1>', [{ question: 'v2 Q', answer: 'v2 A' }], []);
test('Multiple versions maintain correct entry_id', () => {
  assert.strictEqual(pageA2.entry_id, entryA.id);
  assert.strictEqual(pageA2.version, 2);
  const latestB2 = storage.getLatestTopicPage(entryB.id);
  assert.strictEqual(latestB2.version, 1);
  assert.strictEqual(latestB2.qa_history[0].question, 'Q about B');
});

// Cleanup
storage.deleteEntry(entryA.id);
storage.deleteEntry(entryB.id);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
