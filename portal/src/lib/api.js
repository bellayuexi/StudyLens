const API = '';

async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  return res.json();
}

async function apiPost(path, data, { method = 'POST', throwOnError = false } = {}) {
  const isFormData = data instanceof FormData;
  const res = await fetch(`${API}${path}`, {
    method,
    ...(isFormData ? { body: data } : data != null ? {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    } : {}),
  });
  if (throwOnError && !res.ok) throw new Error((await res.json()).error || 'Request failed');
  return res.json();
}

export const fetchGraph = () => apiGet('/api/graph');
export const searchEntries = (q) => apiGet(`/api/entries?q=${encodeURIComponent(q)}`);
export const getTopicPages = (entryId) => apiGet(`/api/entries/${entryId}/topic-pages`);
export const getLatestTopicPage = (entryId) => apiGet(`/api/entries/${entryId}/topic-page/latest`);
export const getChildren = (entryId) => apiGet(`/api/entries/${entryId}/children`);
export const getSettings = () => apiGet('/api/settings');
export const getLLMConfig = () => apiGet('/api/llm/config');
export const getEntryQA = (entryId) => apiGet(`/api/entries/${entryId}/qa`);

export async function getTopicPageByVersion(entryId, version) {
  const data = await apiGet(`/api/entries/${entryId}/topic-page/version/${version}`);
  return data.page || null;
}

export const deleteEntry = (id) => fetch(`${API}/api/entries/${id}`, { method: 'DELETE' });
export const deleteTopicPageVersion = (entryId, version) => apiPost(`/api/entries/${entryId}/topic-page/${version}`, null, { method: 'DELETE' });

export const ingestText = (text, subject = '', maxPoints) => apiPost('/api/ingest', { text, subject, source_type: 'text', ...(maxPoints && { maxPoints }) });
export const updateEntry = (id, data) => apiPost(`/api/entries/${id}`, data, { method: 'PUT' });
export const askQuestion = (question, history = []) => apiPost('/api/qa', { question, history });
export const saveQACards = (question, cards) => apiPost('/api/qa/save', { question, cards });
export const buildQAMindMap = (question, answer, cards = [], relatedEntries = []) => apiPost('/api/qa/mindmap', { question, answer, cards, relatedEntries });
export const generateSmartQuestions = (entryId) => apiPost(`/api/entries/${entryId}/questions`, {});
export const askEntryQuestion = (entryId, question, history = []) => apiPost(`/api/entries/${entryId}/ask`, { question, history });
export const saveEntryQA = (entryId, qaHistory) => apiPost(`/api/entries/${entryId}/qa`, { qaHistory }, { method: 'PUT' });
export const generateTopicPage = (entryId, qaHistory = [], existingHTML = '', requirements = '', mode = '') => apiPost(`/api/entries/${entryId}/topic-page`, { qaHistory, existingHTML, requirements, mode }, { throwOnError: true });
export const saveTopicPage = (entryId, html, qaHistory = [], comments = [], includedQaIds = []) => apiPost(`/api/entries/${entryId}/topic-page/save`, { html, qaHistory, comments, includedQaIds });
export const updateTopicPageComments = (pageId, comments) => apiPost(`/api/topic-pages/${pageId}/comments`, { comments }, { method: 'PUT' });
export const updateTopicPageQaHistory = (pageId, qaHistory) => apiPost(`/api/topic-pages/${pageId}/qa-history`, { qaHistory }, { method: 'PUT' });
export const expandEntry = (entryId) => apiPost(`/api/entries/${entryId}/expand`, {});
export const addChildEntry = (parentId, data) => apiPost(`/api/entries/${parentId}/children`, data);
export const saveSettings = (data) => apiPost('/api/settings', data, { method: 'PUT' });
export const saveLLMConfig = (data) => apiPost('/api/llm/config', data);
export const testLLMProvider = (providerName) => apiPost('/api/llm/test', { providerName });
export const restructureGraph = (instruction, subject = '') => apiPost('/api/restructure', { instruction, subject }, { throwOnError: true });

export async function ingestFile(file, subject = '', maxPoints) {
  const form = new FormData();
  form.append('file', file);
  if (subject) form.append('subject', subject);
  if (maxPoints) form.append('maxPoints', String(maxPoints));
  return apiPost('/api/ingest/file', form, { throwOnError: true });
}

export async function ingestUrl(url, subject = '', maxPoints) {
  return apiPost('/api/ingest/url', { url, subject, ...(maxPoints && { maxPoints }) }, { throwOnError: true });
}
