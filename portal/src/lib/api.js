const API = '';

export async function fetchGraph(backend = 'wiki') {
  const res = await fetch(`${API}/api/graph?backend=${backend}`);
  return res.json();
}

export async function ingestText(text, subject = '') {
  const res = await fetch(`${API}/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, subject, source_type: 'text' }),
  });
  return res.json();
}

export async function deleteEntry(id) {
  await fetch(`${API}/api/entries/${id}`, { method: 'DELETE' });
}

export async function updateEntry(id, data) {
  const res = await fetch(`${API}/api/entries/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function askQuestion(question, history = []) {
  const res = await fetch(`${API}/api/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history }),
  });
  return res.json();
}

export async function saveQACards(question, cards) {
  const res = await fetch(`${API}/api/qa/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, cards }),
  });
  return res.json();
}

export async function ingestFile(file, subject = '') {
  const form = new FormData();
  form.append('file', file);
  if (subject) form.append('subject', subject);
  const res = await fetch(`${API}/api/ingest/file`, { method: 'POST', body: form });
  if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
  return res.json();
}

export async function ingestUrl(url, subject = '') {
  const res = await fetch(`${API}/api/ingest/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, subject }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'URL fetch failed');
  return res.json();
}

export async function searchEntries(q) {
  const res = await fetch(`${API}/api/entries?q=${encodeURIComponent(q)}`);
  return res.json();
}

export async function restructureGraph(instruction, subject = '') {
  const res = await fetch(`${API}/api/restructure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction, subject }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Restructure failed');
  return res.json();
}

export async function buildQAMindMap(question, answer, cards = [], relatedEntries = []) {
  const res = await fetch(`${API}/api/qa/mindmap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, answer, cards, relatedEntries }),
  });
  return res.json();
}

export async function generateSmartQuestions(entryId) {
  const res = await fetch(`${API}/api/entries/${entryId}/questions`, { method: 'POST' });
  return res.json();
}

export async function askEntryQuestion(entryId, question, history = []) {
  const res = await fetch(`${API}/api/entries/${entryId}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history }),
  });
  return res.json();
}

export async function generateTopicPage(entryId, qaHistory = []) {
  const res = await fetch(`${API}/api/entries/${entryId}/topic-page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qaHistory }),
  });
  return res.json();
}

export async function saveTopicPage(entryId, html, qaHistory = [], comments = []) {
  const res = await fetch(`${API}/api/entries/${entryId}/topic-page/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, qaHistory, comments }),
  });
  return res.json();
}

export async function getTopicPages(entryId) {
  const res = await fetch(`${API}/api/entries/${entryId}/topic-pages`);
  return res.json();
}

export async function getTopicPageByVersion(entryId, version) {
  const data = await getTopicPages(entryId);
  return (data.pages || []).find(p => p.version === version) || null;
}

export async function getLatestTopicPage(entryId) {
  const res = await fetch(`${API}/api/entries/${entryId}/topic-page/latest`);
  return res.json();
}

export async function updateTopicPageComments(pageId, comments) {
  const res = await fetch(`${API}/api/topic-pages/${pageId}/comments`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comments }),
  });
  return res.json();
}

export async function updateTopicPageQaHistory(pageId, qaHistory) {
  const res = await fetch(`${API}/api/topic-pages/${pageId}/qa-history`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qaHistory }),
  });
  return res.json();
}

export async function getChildren(entryId) {
  const res = await fetch(`${API}/api/entries/${entryId}/children`);
  return res.json();
}

export async function expandEntry(entryId) {
  const res = await fetch(`${API}/api/entries/${entryId}/expand`, { method: 'POST' });
  return res.json();
}

export async function addChildEntry(parentId, data) {
  const res = await fetch(`${API}/api/entries/${parentId}/children`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}
