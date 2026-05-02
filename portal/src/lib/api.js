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
