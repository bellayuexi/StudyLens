const API = '';

export async function fetchGraph() {
  const res = await fetch(`${API}/api/graph`);
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

export async function askQuestion(question) {
  const res = await fetch(`${API}/api/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
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

export async function searchEntries(q) {
  const res = await fetch(`${API}/api/entries?q=${encodeURIComponent(q)}`);
  return res.json();
}
