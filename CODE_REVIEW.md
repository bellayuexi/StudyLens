# StudyGraph Code Review & Test Framework

## Code Review: EntryDetail.jsx (1007 lines)

### Issues Found

**1. File too large — should split into sub-components**
EntryDetail.jsx is 1007 lines with 38 state variables. Recommend splitting:
- `TopicPageView.jsx` — topic page display, version history, iframe, comments
- `ExploreTab.jsx` — QA history, smart questions, batch ask
- `EntryInfoPanel.jsx` — entry metadata editing (title, content, tags)
- `EntryDetail.jsx` — orchestrator that composes the above

**2. Duplicated QA save logic**
`handleAsk`, `handleRegenerate`, `handleSaveEditedAnswer`, `handleBatchAsk` all contain similar QA-to-save mapping:
```js
const qaToSave = updated.filter(h => !h.loading).map(h => ({ question: h.question, answer: h.answer }));
updateTopicPageQaHistory(topicPageId, qaToSave).catch(() => {});
```
Should extract to a shared `syncQaToServer(updated)` helper.

**3. Cache management is fragile**
`entryDataCacheRef` manually mirrors 12+ state fields. If any new state is added without updating the cache logic (lines 108-113 and 54-92), stale data bugs appear. Consider using `useReducer` or a single state object.

**4. handleBatchAsk race condition potential**
Background tasks in `bgTasksRef` can update state for entries the user has navigated away from. While `entryIdRef` guards exist, the pattern of checking ref inside setState callbacks is error-prone. Each guard is ad-hoc.

**5. Inline styles throughout**
All styling is inline JS objects. For a 1000-line component this hurts readability. Consider CSS modules or at minimum extracting shared style constants.

**6. Error swallowing**
Several `catch (e) { console.error(e); }` blocks. User sees no feedback when API calls fail silently (e.g., `updateTopicPageQaHistory`, `saveTopicPage`).

### Not Issues (Acceptable for Current Scale)
- No TypeScript — fine for a personal learning project
- No i18n framework — all Chinese strings inline is fine
- Direct `fetch` calls — no need for axios/SWR at this scale

---

## Test Framework

### Backend: API Tests (`tests/api.test.mjs`)
Run: `npm run test:api`

| Category | Tests | What's Covered |
|----------|-------|----------------|
| F1: Graph & Entry CRUD | 5 | GET /api/graph structure, has_children flag, parent_id filtering, entry list, 404 handling |
| F2: Topic Page CRUD | 3 | Save validation, latest page, version list |
| F3: Ingest | 1 | Input validation |
| F4: Deep Analysis | 1 | Children endpoint structure |
| F5: Smart Questions | 1 | 404 for nonexistent entry |

### Frontend: Component Tests (`portal/src/test/EntryDetail.test.jsx`)
Run: `npm run test:portal`

| Category | Tests | What's Covered |
|----------|-------|----------------|
| F1: Basic Rendering | 3 | Title display, tab buttons, close button callback |
| F2: Topic Page Generation | 3 | Generate button, requirements input, saved page loading |
| F3: Smart Questions | 2 | Generate button, custom question input |
| F4: Answer Editing | 1 | Edit/regenerate button presence |
| F5: Question Dedup | 1 | Answered question filtering logic |
| F6: Deep Analysis Button | 1 | Hidden for child entries |
| F7: Entry Info | 1 | Title rendering after load |

### Running All Tests
```bash
npm test           # runs both API and portal tests
npm run test:api   # backend only
npm run test:portal # frontend only
```

### Adding New Tests
- Backend: add to `tests/api.test.mjs`, follow the `F{N}: Category` naming
- Frontend: add to `portal/src/test/EntryDetail.test.jsx` or create new test files
- All API mocks are in the test file's `vi.mock('../lib/api.js', ...)` block

### What's NOT Tested (Needs Manual Verification)
- LLM response quality (empty HTML, content accuracy)
- Iframe inline annotation (requires real DOM + postMessage)
- Drag-to-resize panels
- Real API calls with LLM integration
- Topic page visual rendering quality
- Browser-specific rendering issues
