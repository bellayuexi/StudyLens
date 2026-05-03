import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteEntry, updateEntry, generateSmartQuestions, askEntryQuestion, generateTopicPage, saveTopicPage, getLatestTopicPage, getTopicPages, getTopicPageByVersion, updateTopicPageComments, updateTopicPageQaHistory } from '../lib/api.js';

const QUESTION_COLORS = { '概念': '#4285f4', '原因': '#ea4335', '影响': '#34a853', '对比': '#fbbc05', '思考': '#9c27b0', '自定义': '#ff6d00' };

const styles = {
  input: { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #2a2d45', background: '#1c1f2e', color: '#ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' },
  btnPrimary: { padding: '4px 12px', borderRadius: 4, border: 'none', background: '#34a853', color: '#fff', cursor: 'pointer', fontSize: 11 },
  btnCancel: { padding: '4px 12px', borderRadius: 4, border: 'none', background: '#666', color: '#fff', cursor: 'pointer', fontSize: 11 },
  btnSmall: { padding: '3px 10px', borderRadius: 4, border: 'none', fontSize: 11, cursor: 'pointer' },
  panel: { background: '#161822', borderBottom: '1px solid #2a2d35' },
  card: { background: '#161822', border: '1px solid #2a2d35', borderRadius: 8 },
};

export default function EntryDetail({ entry, allEntries = [], onClose, onDeleted, onNavigate, onUpdated }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('topic');
  const [smartQuestions, setSmartQuestions] = useState([]);
  const [selectedQs, setSelectedQs] = useState(new Set());
  const [loadingQ, setLoadingQ] = useState(false);
  const [editingQIdx, setEditingQIdx] = useState(null);
  const [editingQText, setEditingQText] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [qaHistory, setQaHistory] = useState([]);
  const [asking, setAsking] = useState(false);
  const [topicHTML, setTopicHTML] = useState('');
  const [topicPageId, setTopicPageId] = useState(null);
  const [topicVersion, setTopicVersion] = useState(0);
  const [topicVersionCount, setTopicVersionCount] = useState(0);
  const [viewingVersion, setViewingVersion] = useState(null);
  const [loadingTopic, setLoadingTopic] = useState(false);
  const [topicStatus, setTopicStatus] = useState('');
  const [topicDirty, setTopicDirty] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [comments, setComments] = useState([]);
  const [commentMode, setCommentMode] = useState(false);
  const [topicRequirements, setTopicRequirements] = useState('');
  const [newComment, setNewComment] = useState('');
  const [editingField, setEditingField] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [includedQaIds, setIncludedQaIds] = useState([]);
  const [collapsedCats, setCollapsedCats] = useState(new Set());
  const [editingQaIdx, setEditingQaIdx] = useState(null);
  const [editingAnswer, setEditingAnswer] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const qaRef = useRef(null);
  const questionsCacheRef = useRef({});
  const entryIdRef = useRef(entry.id);
  const bgTasksRef = useRef({});
  const askingCountRef = useRef(0);
  const entryDataCacheRef = useRef({});
  const [loadingEntry, setLoadingEntry] = useState(false);

  const cacheableState = () => ({
    topicHTML, topicPageId, topicVersion, topicVersionCount,
    qaHistory, includedQaIds, comments, lastUpdated,
    topicStatus, topicDirty, asking, loadingTopic,
  });

  const restoreCache = (cached) => {
    setAsking(cached.asking || false);
    setLoadingQ(false);
    setLoadingTopic(cached.loadingTopic || false);
    setTopicHTML(cached.topicHTML || '');
    setTopicPageId(cached.topicPageId || null);
    setTopicVersion(cached.topicVersion || 0);
    setTopicVersionCount(cached.topicVersionCount || 0);
    setQaHistory(cached.qaHistory || []);
    setComments(cached.comments || []);
    setIncludedQaIds(cached.includedQaIds || []);
    setLastUpdated(cached.lastUpdated || '');
    setTopicStatus(cached.topicStatus || '');
    setTopicDirty(cached.topicDirty || false);
    setViewingVersion(null);
    setTab('topic');
    setLoadingEntry(false);
  };

  const syncQaToServer = (updated, pageId = topicPageId) => {
    if (!pageId) return;
    const qaToSave = updated.filter(h => !h.loading).map(h => ({ question: h.question, answer: h.answer }));
    updateTopicPageQaHistory(pageId, qaToSave).catch(e => {
      console.error('QA sync failed:', e);
      showError('QA保存失败');
    });
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  };

  useEffect(() => {
    entryIdRef.current = entry.id;
    setEditingField(null);
    setCommentMode(false);

    // Restore from cache immediately if available
    const cached = entryDataCacheRef.current[entry.id];
    if (cached) {
      restoreCache(cached);
    } else {
      setAsking(false);
      setLoadingQ(false);
      setLoadingTopic(false);
      setSmartQuestions([]);
      setSelectedQs(new Set());
      setQaHistory([]);
      setTopicHTML('');
      setTopicPageId(null);
      setTopicVersion(0);
      setTopicVersionCount(0);
      setViewingVersion(null);
      setTopicStatus('');
      setTopicDirty(false);
      setLastUpdated('');
      setComments([]);
      setIncludedQaIds([]);
      setCollapsedCats(new Set());
      setTab('topic');
      setLoadingEntry(true);
      loadSavedTopicPage();
    }

    // Load cached questions if available, or derive from qa_history
    const cachedQs = questionsCacheRef.current[entry.id];
    if (cachedQs) {
      setSmartQuestions(cachedQs);
      setSelectedQs(new Set(cachedQs.map(q => q.id)));
    } else {
      setSmartQuestions([]);
      setSelectedQs(new Set());
    }
  }, [entry.id]);

  // Cache current entry data when it changes
  useEffect(() => {
    if (!entry.id || loadingEntry) return;
    entryDataCacheRef.current[entry.id] = cacheableState();
  }, [topicHTML, topicPageId, topicVersion, topicVersionCount, qaHistory, includedQaIds, comments, lastUpdated, topicStatus, topicDirty, asking, loadingTopic]);

  const loadSavedTopicPage = async () => {
    const currentId = entry.id;
    try {
      const data = await getLatestTopicPage(currentId);
      if (entryIdRef.current !== currentId) return;
      if (data.page) {
        setTopicHTML(data.page.html);
        setTopicPageId(data.page.id);
        setTopicVersion(data.page.version);
        setTopicVersionCount(data.page.version);
        setComments(data.page.comments || []);
        setIncludedQaIds(data.page.included_qa_ids || []);
        const qa = (data.page.qa_history || []).filter(h => h.answer);
        setQaHistory(qa);
        setLastUpdated(data.page.created_at);
        setTopicStatus(`v${data.page.version} 已保存`);
        setTopicDirty(false);
      }
    } catch (e) { console.error(e); showError('加载专题页失败'); }
    if (entryIdRef.current === currentId) setLoadingEntry(false);
  };

  const loadSmartQuestions = async () => {
    const currentId = entry.id;
    if (entryIdRef.current === currentId) setLoadingQ(true);
    try {
      const data = await generateSmartQuestions(currentId);
      const qs = (data.questions || []).map((q, i) => {
        const answered = qaHistory.some(h => h.answer && (
          h.question === q.question || h.question.includes(q.question) || q.question.includes(h.question)
        ));
        return { ...q, id: i, answered };
      });
      questionsCacheRef.current[currentId] = qs;
      if (entryIdRef.current === currentId) {
        setSmartQuestions(qs);
        setSelectedQs(new Set(qs.filter(q => !q.answered).map(q => q.id)));
      }
    } catch (e) { console.error(e); showError('生成智能问题失败'); }
    if (entryIdRef.current === currentId) setLoadingQ(false);
  };

  const toggleQ = (id) => {
    setSelectedQs(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const deleteQ = (id) => {
    setSmartQuestions(prev => prev.filter(q => q.id !== id));
    setSelectedQs(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const saveEditQ = (id) => {
    if (!editingQText.trim()) return;
    setSmartQuestions(prev => prev.map(q => q.id === id ? { ...q, question: editingQText.trim() } : q));
    setEditingQIdx(null);
  };

  const addCustomQuestion = () => {
    if (!newQuestion.trim()) return;
    const id = Date.now();
    const q = { id, question: newQuestion.trim(), category: '自定义' };
    setSmartQuestions(prev => [...prev, q]);
    setSelectedQs(prev => new Set(prev).add(id));
    setNewQuestion('');
  };

  const handleAsk = async (question) => {
    if (!question || asking) return;
    const askingEntryId = entry.id;
    const askingPageId = topicPageId;
    setAsking(true);
    const history = qaHistory.map(h => ({ question: h.question, answer: h.answer }));
    setQaHistory(prev => [...prev, { question, answer: '', loading: true }]);
    try {
      const data = await askEntryQuestion(askingEntryId, question, history);
      if (entryIdRef.current !== askingEntryId) {
        syncQaToServer([...history, { question, answer: data.answer }], askingPageId);
        setAsking(false);
        return;
      }
      const newItem = { question, answer: data.answer, cards: data.suggestedCards || [], loading: false };
      setQaHistory(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = newItem;
        syncQaToServer(updated, askingPageId);
        return updated;
      });
      setTopicDirty(true);
    } catch (err) {
      if (entryIdRef.current !== askingEntryId) { setAsking(false); return; }
      setQaHistory(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { question, answer: `错误: ${err.message}`, loading: false };
        return updated;
      });
    }
    setAsking(false);
    setTimeout(() => qaRef.current?.scrollTo(0, qaRef.current.scrollHeight), 100);
  };

  const handleRegenerate = async (idx) => {
    const item = qaHistory[idx];
    if (!item || item.loading) return;
    const question = item.question;
    const qid = item._qid;
    setQaHistory(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], answer: '', loading: true };
      return updated;
    });
    setAsking(true);
    try {
      const history = qaHistory.filter((h, i) => i !== idx && !h.loading).map(h => ({ question: h.question, answer: h.answer }));
      const data = await askEntryQuestion(entry.id, question, history);
      setQaHistory(prev => {
        const updated = [...prev];
        updated[idx] = { question, answer: data.answer, cards: data.suggestedCards || [], loading: false, _qid: qid };
        syncQaToServer(updated);
        return updated;
      });
      setTopicDirty(true);
    } catch (err) {
      setQaHistory(prev => {
        const updated = [...prev];
        updated[idx] = { question, answer: `错误: ${err.message}`, loading: false, _qid: qid };
        return updated;
      });
    }
    setAsking(false);
  };

  const handleSaveEditedAnswer = (idx) => {
    setQaHistory(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], answer: editingAnswer };
      syncQaToServer(updated);
      return updated;
    });
    setTopicDirty(true);
    setEditingQaIdx(null);
    setEditingAnswer('');
  };

  const handleBatchAsk = async () => {
    const selected = smartQuestions.filter(q => selectedQs.has(q.id));
    if (!selected.length) return;
    const batchEntryId = entry.id;
    const batchPageId = topicPageId;
    const baseHistory = qaHistory.filter(h => !h.loading).map(h => ({ question: h.question, answer: h.answer }));

    // Only set asking if we're on this entry
    if (entryIdRef.current === batchEntryId) setAsking(true);

    // Show all questions as loading in UI
    const loadingItems = selected.map(q => ({ question: q.question, answer: '', loading: true, _qid: q.id }));
    if (entryIdRef.current === batchEntryId) {
      setQaHistory(prev => [...prev, ...loadingItems]);
    }

    // Also ensure cache reflects asking state
    const c = entryDataCacheRef.current[batchEntryId];
    if (c) {
      c.asking = true;
      c.qaHistory = [...(c.qaHistory || []), ...loadingItems];
    }

    // Track results for persistence
    const results = {};

    // Fire all questions in parallel
    const promises = selected.map(async (q) => {
      try {
        const data = await askEntryQuestion(batchEntryId, q.question, baseHistory);
        results[q.id] = { question: q.question, answer: data.answer, cards: data.suggestedCards || [], loading: false };
      } catch (err) {
        results[q.id] = { question: q.question, answer: `错误: ${err.message}`, loading: false };
      }

      // Update UI if still on same entry, otherwise update cache
      if (entryIdRef.current === batchEntryId) {
        setQaHistory(prev => prev.map(h => h._qid === q.id ? { ...results[q.id], _qid: q.id } : h));
        setTopicDirty(true);
      } else {
        const c = entryDataCacheRef.current[batchEntryId];
        if (c) {
          c.qaHistory = (c.qaHistory || []).map(h => h._qid === q.id ? { ...results[q.id], _qid: q.id } : h);
          c.topicDirty = true;
        }
      }

      // Persist incrementally
      if (batchPageId) {
        const allDone = [...baseHistory, ...Object.values(results).map(r => ({ question: r.question, answer: r.answer }))];
        syncQaToServer(allDone, batchPageId);
      }
    });

    await Promise.all(promises);
    if (entryIdRef.current === batchEntryId) {
      setAsking(false);
      setTimeout(() => qaRef.current?.scrollTo(0, qaRef.current.scrollHeight), 100);
    } else {
      const c = entryDataCacheRef.current[batchEntryId];
      if (c) c.asking = false;
    }
  };

  const injectTimestamp = (html) => {
    const ts = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const badge = `<div style="text-align:right;padding:8px 16px;font-size:11px;color:#666;border-bottom:1px solid #333;">最后更新: ${ts}</div>`;
    return html.replace(/<body[^>]*>/, (m) => m + badge) || badge + html;
  };

  const handleGenerateTopic = async () => {
    const genEntryId = entry.id;
    setLoadingTopic(true);
    setTopicStatus('正在生成...');
    try {
      const data = await generateTopicPage(genEntryId, qaHistory, '', topicRequirements);
      if (!data.html || data.html.replace(/<[^>]*>/g, '').trim().length < 50) {
        if (entryIdRef.current === genEntryId) setTopicStatus('生成内容为空，请重试');
        setLoadingTopic(false);
        return;
      }
      if (entryIdRef.current !== genEntryId) {
        const c = entryDataCacheRef.current[genEntryId];
        if (c) { c.loadingTopic = false; c.topicHTML = data.html; c.topicStatus = '已生成（后台完成）'; }
        return;
      }
      const html = injectTimestamp(data.html);
      const qaIds = qaHistory.filter(h => h.answer && !h.loading).map((h, i) => h._qid || `qa_${i}`);
      setTopicHTML(html);
      setTab('topic');
      try {
        const saved = await saveTopicPage(genEntryId, html, qaHistory, comments, qaIds);
        if (entryIdRef.current !== genEntryId) {
          const c = entryDataCacheRef.current[genEntryId];
          if (c) { c.loadingTopic = false; c.topicPageId = saved.id; c.topicVersion = saved.version; c.topicVersionCount = saved.version; c.lastUpdated = saved.created_at; c.topicStatus = `v${saved.version} 已保存`; c.topicDirty = false; c.topicHTML = html; }
          return;
        }
        setTopicPageId(saved.id);
        setTopicVersion(saved.version);
        setTopicVersionCount(saved.version);
        setLastUpdated(saved.created_at);
        setViewingVersion(null);
        setTopicStatus(`v${saved.version} 已保存`);
        setTopicDirty(false);
        setIncludedQaIds(qaIds);
      } catch (saveErr) {
        console.error('Save failed:', saveErr);
        if (entryIdRef.current === genEntryId) { setTopicStatus('已生成（保存失败，请重试）'); showError('专题页保存失败'); }
      }
    } catch (err) {
      if (entryIdRef.current === genEntryId) { setTopicStatus('生成失败'); showError('专题页生成失败'); }
      console.error(err);
    }
    if (entryIdRef.current === genEntryId) {
      setLoadingTopic(false);
    } else {
      const c = entryDataCacheRef.current[genEntryId];
      if (c) c.loadingTopic = false;
    }
  };

  const handleRefreshTopic = async () => {
    const genEntryId = entry.id;
    setLoadingTopic(true);
    setTopicStatus('正在更新...');
    try {
      const data = await generateTopicPage(genEntryId, qaHistory, topicHTML, topicRequirements);
      if (!data.html || data.html.replace(/<[^>]*>/g, '').trim().length < 50) {
        if (entryIdRef.current === genEntryId) setTopicStatus('生成内容为空，请重试');
        setLoadingTopic(false);
        return;
      }
      const html = injectTimestamp(data.html);
      const qaIds = qaHistory.filter(h => h.answer && !h.loading).map((h, i) => h._qid || `qa_${i}`);
      if (entryIdRef.current !== genEntryId) {
        const c = entryDataCacheRef.current[genEntryId];
        if (c) { c.loadingTopic = false; c.topicHTML = html; c.topicStatus = '已更新（后台完成）'; }
        try { await saveTopicPage(genEntryId, html, qaHistory, comments, qaIds); } catch {}
        return;
      }
      setTopicHTML(html);
      try {
        const saved = await saveTopicPage(genEntryId, html, qaHistory, comments, qaIds);
        if (entryIdRef.current !== genEntryId) {
          const c = entryDataCacheRef.current[genEntryId];
          if (c) { c.loadingTopic = false; c.topicPageId = saved.id; c.topicVersion = saved.version; c.topicVersionCount = saved.version; c.lastUpdated = saved.created_at; c.topicStatus = `v${saved.version} 已保存`; c.topicDirty = false; c.topicHTML = html; }
          return;
        }
        setTopicPageId(saved.id);
        setTopicVersion(saved.version);
        setTopicVersionCount(saved.version);
        setLastUpdated(saved.created_at);
        setViewingVersion(null);
        setTopicStatus(`v${saved.version} 已保存`);
        setTopicDirty(false);
        setIncludedQaIds(qaIds);
      } catch (saveErr) {
        console.error('Save failed:', saveErr);
        if (entryIdRef.current === genEntryId) { setTopicStatus('已更新（保存失败，请重试）'); showError('专题页保存失败'); }
      }
    } catch (err) {
      if (entryIdRef.current === genEntryId) { setTopicStatus('更新失败'); showError('专题页更新失败'); }
    }
    if (entryIdRef.current === genEntryId) {
      setLoadingTopic(false);
    } else {
      const c = entryDataCacheRef.current[genEntryId];
      if (c) c.loadingTopic = false;
    }
  };

  const viewVersion = async (v) => {
    if (v === topicVersion) {
      setViewingVersion(null);
      loadSavedTopicPage();
      return;
    }
    try {
      const page = await getTopicPageByVersion(entry.id, v);
      if (page) {
        setTopicHTML(page.html);
        setViewingVersion(v);
        setTopicStatus(`正在查看 v${v}`);
      }
    } catch (e) { console.error(e); showError('加载版本失败'); }
  };

  const addComment = () => {
    if (!newComment.trim()) return;
    const updated = [...comments, { id: Date.now(), text: newComment.trim(), created: new Date().toISOString() }];
    setComments(updated);
    setNewComment('');
    if (topicPageId) updateTopicPageComments(topicPageId, updated);
  };

  const removeComment = (cid) => {
    const updated = comments.filter(c => c.id !== cid);
    setComments(updated);
    if (topicPageId) updateTopicPageComments(topicPageId, updated);
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === 'inline-comment') {
        setCommentMode(true);
        setNewComment(`【针对: "${e.data.selectedText.slice(0, 50)}"】`);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleApplyComments = async () => {
    if (!comments.length) return;
    setLoadingTopic(true);
    setTopicStatus('根据批注更新中...');
    try {
      const commentText = comments.map(c => c.text).join('\n');
      const data = await generateTopicPage(entry.id, qaHistory, topicHTML, `请根据以下批注对现有页面做局部修改，保留原有内容结构和格式，仅针对批注内容进行调整:\n${commentText}`);
      const html = injectTimestamp(data.html || '');
      setTopicHTML(html);
      const saved = await saveTopicPage(entry.id, html, qaHistory, []);
      setTopicPageId(saved.id);
      setTopicVersion(saved.version);
      setTopicVersionCount(saved.version);
      setLastUpdated(saved.created_at);
      setViewingVersion(null);
      setComments([]);
      setTopicStatus(`v${saved.version} 已保存（已应用批注）`);
      setTopicDirty(false);
    } catch (err) {
      setTopicStatus('应用批注失败');
      showError('应用批注失败');
    }
    setLoadingTopic(false);
  };

  const startFieldEdit = (field) => {
    setEditForm({ title: entry.title, content: entry.content, subject: entry.subject, tags: [...(entry.tags || [])] });
    setEditingField(field);
    setTagInput('');
  };

  const saveField = async () => {
    setSaving(true);
    try {
      await updateEntry(entry.id, editForm);
      setEditingField(null);
      if (onUpdated) onUpdated();
    } catch (e) { showError('保存失败'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await deleteEntry(entry.id); onDeleted(); } catch (e) { showError('删除失败'); }
  };

  const inputStyle = styles.input;

  const renderAnswer = (text) => {
    if (!text) return null;
    return text.split('\n').filter(Boolean).map((para, i) => (
      <p key={i} style={{ margin: '6px 0', lineHeight: 1.8 }}>{para}</p>
    ));
  };

  return (
    <div style={{ height: '100%', background: '#0f1117', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Error toast */}
      {errorMsg && (
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          padding: '8px 20px', borderRadius: 8, background: '#d32f2f', color: '#fff', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
          {errorMsg}
        </div>
      )}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #2a2d35', background: '#161822' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          {editingField === 'title' ? (
            <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })}
              onBlur={saveField} onKeyDown={e => { if (e.key === 'Enter') saveField(); if (e.key === 'Escape') setEditingField(null); }}
              autoFocus style={{ ...inputStyle, fontSize: 20, fontWeight: 600, flex: 1 }} />
          ) : (
            <h2 onClick={() => startFieldEdit('title')} style={{ margin: 0, fontSize: 20, color: '#fff', flex: 1, cursor: 'pointer' }} title="点击编辑">{entry.title}</h2>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={handleDelete} style={{ background: '#d32f2f22', border: '1px solid #d32f2f44', color: '#ef5350', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '4px 10px' }}>删除</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 22, padding: '0 4px' }}>×</button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#888', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {editingField === 'subject' ? (
            <input value={editForm.subject} onChange={e => setEditForm({ ...editForm, subject: e.target.value })}
              onBlur={saveField} onKeyDown={e => { if (e.key === 'Enter') saveField(); if (e.key === 'Escape') setEditingField(null); }}
              autoFocus style={{ ...inputStyle, width: 120, fontSize: 12, padding: '2px 8px' }} />
          ) : (
            entry.subject && <span onClick={() => startFieldEdit('subject')} style={{ background: '#2a2d45', padding: '2px 10px', borderRadius: 10, cursor: 'pointer' }} title="点击编辑">{entry.subject}</span>
          )}
          <span style={{ background: '#1c1f2e', padding: '2px 10px', borderRadius: 10 }}>{entry.created_date}</span>
          {(entry.tags || []).map((t, i) => (
            <span key={i} style={{ background: '#1c1f2e', padding: '2px 8px', borderRadius: 10, fontSize: 11, color: '#777' }}>#{t}</span>
          ))}
          {editingField === 'tags' ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { const t = tagInput.trim(); if (t && !editForm.tags.includes(t)) setEditForm({ ...editForm, tags: [...editForm.tags, t] }); setTagInput(''); }
                  if (e.key === 'Escape') { saveField(); }
                }}
                autoFocus placeholder="添加标签..." style={{ ...inputStyle, width: 80, fontSize: 11, padding: '2px 6px' }} />
              <button onClick={saveField} style={{ fontSize: 10, color: '#34a853', background: 'none', border: 'none', cursor: 'pointer' }}>✓</button>
            </div>
          ) : (
            <span onClick={() => startFieldEdit('tags')} style={{ fontSize: 11, color: '#4285f4', cursor: 'pointer' }}>+标签</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #2a2d35', background: '#161822' }}>
        {[
          { id: 'topic', label: '📄 专题页' },
          { id: 'explore', label: '🔍 探索更多' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer', fontSize: 13,
              background: tab === t.id ? '#2a2d45' : 'transparent', color: tab === t.id ? '#fff' : '#777',
              borderBottom: tab === t.id ? '2px solid #4285f4' : '2px solid transparent' }}>
            {t.label}
            {t.id === 'topic' && topicVersion > 0 && (
              <span style={{ fontSize: 10, marginLeft: 4, color: '#34a853' }}>v{topicVersion}</span>
            )}
            {t.id === 'explore' && (() => {
              const answered = qaHistory.filter(h => h.answer && !h.loading);
              const newCount = answered.filter((h, i) => !includedQaIds.includes(h._qid || `qa_${i}`)).length;
              return newCount > 0 ? <span style={{ fontSize: 10, marginLeft: 4, color: '#fbbc05' }}>+{newCount}</span> : null;
            })()}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loadingEntry && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
            <div style={{ fontSize: 13 }}>加载中...</div>
          </div>
        </div>
      )}

      {/* Topic Page Tab */}
      {!loadingEntry && tab === 'topic' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Content overview */}
          {editingField === 'content' ? (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #2a2d35' }}>
              <textarea value={editForm.content} onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                rows={4} style={{ ...inputStyle, lineHeight: 1.8, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button onClick={saveField} disabled={saving} style={{ padding: '4px 12px', borderRadius: 4, border: 'none', background: '#34a853', color: '#fff', cursor: 'pointer', fontSize: 11 }}>
                  {saving ? '...' : '保存'}
                </button>
                <button onClick={() => setEditingField(null)} style={{ padding: '4px 12px', borderRadius: 4, border: 'none', background: '#666', color: '#fff', cursor: 'pointer', fontSize: 11 }}>取消</button>
              </div>
            </div>
          ) : (
            <div onClick={() => startFieldEdit('content')}
              style={{ fontSize: 13, lineHeight: 1.7, color: '#bbb', background: '#161822', padding: '10px 16px', borderBottom: '1px solid #2a2d35', cursor: 'pointer', maxHeight: 80, overflow: 'hidden' }}
              title="点击编辑">
              {entry.content}
            </div>
          )}
          {/* Toolbar */}
          <div style={{ padding: '6px 16px', borderBottom: '1px solid #2a2d35', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#161822', flexWrap: 'wrap', gap: 4 }}>
            <div style={{ fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{topicStatus || (loadingTopic ? '生成中...' : '未生成')}</span>
              {/* Version browser */}
              {topicVersionCount > 1 && (
                <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  {Array.from({ length: topicVersionCount }, (_, i) => i + 1).map(v => (
                    <button key={v} onClick={() => viewVersion(v)}
                      style={{ padding: '1px 6px', borderRadius: 3, border: 'none', cursor: 'pointer', fontSize: 10,
                        background: (viewingVersion === v || (!viewingVersion && v === topicVersion)) ? '#4285f4' : '#1c1f2e',
                        color: (viewingVersion === v || (!viewingVersion && v === topicVersion)) ? '#fff' : '#666' }}>
                      v{v}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setCommentMode(!commentMode)}
                style={{ padding: '3px 10px', borderRadius: 4, border: 'none', fontSize: 11, cursor: 'pointer',
                  background: commentMode ? '#fbbc0544' : '#1c1f2e', color: commentMode ? '#fbbc05' : '#888' }}>
                {commentMode ? '✎ 批注中' : '✎ 添加批注'}
                {comments.length > 0 && <span style={{ marginLeft: 4, color: '#fbbc05' }}>({comments.length})</span>}
              </button>
              {comments.length > 0 && (
                <button onClick={handleApplyComments} disabled={loadingTopic}
                  style={{ padding: '3px 10px', borderRadius: 4, border: 'none', fontSize: 11, cursor: loadingTopic ? 'wait' : 'pointer',
                    background: '#9c27b033', color: '#ce93d8' }}>
                  应用批注更新
                </button>
              )}
              {topicHTML && (
                <button onClick={() => {
                  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${entry.title} - 专题页</title></head><body>${topicHTML}</body></html>`;
                  const blob = new Blob([fullHtml], { type: 'text/html' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `${entry.title}_专题页_v${topicVersion}.html`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
                  style={{ padding: '3px 10px', borderRadius: 4, border: 'none', fontSize: 11, cursor: 'pointer',
                    background: '#1c1f2e', color: '#888' }}>
                  📥 导出HTML
                </button>
              )}
              <button onClick={topicDirty ? handleRefreshTopic : handleGenerateTopic}
                disabled={loadingTopic || (!topicDirty && topicVersion > 0)}
                style={{ padding: '3px 10px', borderRadius: 4, border: 'none', fontSize: 11,
                  cursor: (loadingTopic || (!topicDirty && topicVersion > 0)) ? 'default' : 'pointer',
                  background: loadingTopic ? '#333' : topicDirty ? '#4285f4' : '#1c1f2e',
                  color: loadingTopic ? '#666' : topicDirty ? '#fff' : '#555',
                  opacity: (!topicDirty && topicVersion > 0 && !loadingTopic) ? 0.5 : 1 }}>
                {loadingTopic ? '更新中...' : topicDirty ? '🔄 用新回答更新' : '🔄 重新生成'}
              </button>
            </div>
          </div>

          {/* Viewing old version banner */}
          {viewingVersion && viewingVersion !== topicVersion && (
            <div style={{ padding: '6px 16px', background: '#fbbc0522', borderBottom: '1px solid #fbbc0544', fontSize: 12, color: '#fbbc05', display: 'flex', justifyContent: 'space-between' }}>
              <span>正在查看历史版本 v{viewingVersion}（最新为 v{topicVersion}）</span>
              <span onClick={() => viewVersion(topicVersion)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>返回最新版</span>
            </div>
          )}

          {/* Comments panel */}
          {commentMode && (
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #2a2d35', background: '#1a1c28' }}>
              <div style={{ fontSize: 11, color: '#fbbc05', marginBottom: 6 }}>批注（输入修改建议，点击"应用批注更新"来更新专题页）</div>
              {comments.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4, padding: '4px 8px', background: '#161822', borderRadius: 6, borderLeft: '2px solid #fbbc05' }}>
                  <span style={{ flex: 1, fontSize: 12, color: '#ddd' }}>{c.text}</span>
                  <span onClick={() => removeComment(c.id)} style={{ color: '#666', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>×</span>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <input value={newComment} onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addComment(); }}
                  placeholder="例如: 第二章需要扩充更多细节..."
                  style={{ ...inputStyle, flex: 1, fontSize: 12 }} />
                <button onClick={addComment} disabled={!newComment.trim()}
                  style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#fbbc05', color: '#000', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>+</button>
              </div>
            </div>
          )}

          {/* Content */}
          {loadingTopic && !topicHTML ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#888' }}>
              <div style={{ fontSize: 36 }}>⏳</div>
              <div style={{ fontSize: 14 }}>正在根据智能问题自动生成专题页面...</div>
              <div style={{ fontSize: 12, color: '#666', maxWidth: 400, textAlign: 'center' }}>
                系统会用AI生成的学习问题来构建专题页面，首次生成可能需要10-30秒
              </div>
            </div>
          ) : topicHTML ? (
            <iframe srcDoc={topicHTML + `<script>
document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
var _ann_text = '';
document.addEventListener('mouseup', function(e) {
  setTimeout(function() {
    var sel = window.getSelection();
    var text = sel.toString().trim();
    var old = document.getElementById('_ann_btn');
    if (old) old.remove();
    if (!text) return;
    _ann_text = text;
    var btn = document.createElement('div');
    btn.id = '_ann_btn';
    btn.textContent = '+ 添加批注';
    btn.style.cssText = 'position:fixed;z-index:9999;padding:6px 14px;background:#fbbc05;color:#000;border-radius:6px;font-size:13px;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,0.4);user-select:none;-webkit-user-select:none;';
    var x = Math.min(e.clientX, window.innerWidth - 120);
    var y = Math.max(e.clientY - 36, 4);
    btn.style.left = x + 'px';
    btn.style.top = y + 'px';
    btn.onmousedown = function(ev) { ev.preventDefault(); ev.stopPropagation(); };
    btn.onclick = function(ev) {
      ev.stopPropagation();
      window.parent.postMessage({ type: 'inline-comment', selectedText: _ann_text }, '*');
      btn.remove();
    };
    document.body.appendChild(btn);
  }, 10);
});
document.addEventListener('mousedown', function(e) {
  if (e.target.id !== '_ann_btn') { var old = document.getElementById('_ann_btn'); if (old) old.remove(); }
});
<\/script>`} style={{ flex: 1, border: 'none', background: '#0f1117' }} title="知识专题" />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#666' }}>
              <div style={{ fontSize: 48 }}>📄</div>
              {qaHistory.filter(h => h.answer && !h.loading).length > 0 ? (
                <>
                  <div style={{ fontSize: 14 }}>尚未生成专题页</div>
                  <input value={topicRequirements} onChange={e => setTopicRequirements(e.target.value)}
                    placeholder="输入你对专题页的要求（可选，如：重点讲解背景原因）"
                    style={{ width: 360, padding: '8px 12px', borderRadius: 6, border: '1px solid #2a2d45', background: '#1c1f2e', color: '#ddd', fontSize: 12, outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
                  <button onClick={handleGenerateTopic} disabled={loadingTopic}
                    style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#4285f4', color: '#fff', cursor: 'pointer', fontSize: 14 }}>
                    {loadingTopic ? '生成中...' : '生成专题页'}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, marginBottom: 4 }}>选择一种方式开始学习</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <div onClick={() => setTab('explore')}
                      style={{ width: 200, padding: '16px', borderRadius: 10, border: '1px solid #34a85344', background: '#34a85311', cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                      <div style={{ fontSize: 14, color: '#34a853', fontWeight: 600, marginBottom: 4 }}>智能问答探索</div>
                      <div style={{ fontSize: 11, color: '#888' }}>AI生成问题，逐个回答后生成专题页</div>
                    </div>
                    {!entry.parent_id && (
                      <div onClick={() => navigate(`/deep/${entry.id}`)}
                        style={{ width: 200, padding: '16px', borderRadius: 10, border: '1px solid #9c27b044', background: '#9c27b011', cursor: 'pointer', textAlign: 'center' }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>🔬</div>
                        <div style={{ fontSize: 14, color: '#ce93d8', fontWeight: 600, marginBottom: 4 }}>深入分析</div>
                        <div style={{ fontSize: 11, color: '#888' }}>拆解为子主题，逐个深入探索</div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Explore Tab */}
      {!loadingEntry && tab === 'explore' && (
        <div ref={qaRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {/* Content */}
          {editingField === 'content' ? (
            <div style={{ marginBottom: 16 }}>
              <textarea value={editForm.content} onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                rows={6} style={{ ...inputStyle, lineHeight: 1.8, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button onClick={saveField} disabled={saving} style={{ padding: '4px 12px', borderRadius: 4, border: 'none', background: '#34a853', color: '#fff', cursor: 'pointer', fontSize: 11 }}>
                  {saving ? '...' : '保存'}
                </button>
                <button onClick={() => setEditingField(null)} style={{ padding: '4px 12px', borderRadius: 4, border: 'none', background: '#666', color: '#fff', cursor: 'pointer', fontSize: 11 }}>取消</button>
              </div>
            </div>
          ) : (
            <div onClick={() => startFieldEdit('content')}
              style={{ fontSize: 14, lineHeight: 1.8, color: '#ddd', background: '#161822', padding: '14px 16px', borderRadius: 8, marginBottom: 16, border: '1px solid #2a2d35', cursor: 'pointer' }}
              title="点击编辑">
              {entry.content}
            </div>
          )}

          {/* Answered QAs grouped by category */}
          {(() => {
            const answered = qaHistory.filter(h => h.answer && !h.loading);
            if (answered.length === 0) return null;
            const groups = {};
            answered.forEach((h, i) => {
              const cat = h.category || (smartQuestions.find(q => q.question === h.question)?.category) || '其他';
              if (!groups[cat]) groups[cat] = [];
              groups[cat].push({ ...h, idx: i });
            });
            const newQaCount = answered.filter((h, i) => {
              const qid = h._qid || `qa_${i}`;
              return !includedQaIds.includes(qid);
            }).length;
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                    {answered.length} 个已回答问题
                  </span>
                  {topicHTML && newQaCount > 0 && (
                    <button onClick={handleRefreshTopic} disabled={loadingTopic}
                      style={{ padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 12,
                        background: '#9c27b033', color: '#ce93d8', cursor: loadingTopic ? 'wait' : 'pointer' }}>
                      {loadingTopic ? '更新中...' : `更新专题页 (+${newQaCount}个新回答)`}
                    </button>
                  )}
                  {!topicHTML && (
                    <button onClick={handleGenerateTopic} disabled={loadingTopic}
                      style={{ padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 12,
                        background: '#34a85333', color: '#34a853', cursor: loadingTopic ? 'wait' : 'pointer' }}>
                      {loadingTopic ? '生成中...' : '生成专题页'}
                    </button>
                  )}
                </div>
                {Object.entries(groups).map(([cat, items]) => {
                  const collapsed = collapsedCats.has(cat);
                  return (
                    <div key={cat} style={{ marginBottom: 8 }}>
                      <div onClick={() => setCollapsedCats(prev => {
                        const next = new Set(prev);
                        collapsed ? next.delete(cat) : next.add(cat);
                        return next;
                      })}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6,
                          background: '#161822', cursor: 'pointer', borderLeft: `3px solid ${QUESTION_COLORS[cat] || '#666'}` }}>
                        <span style={{ fontSize: 12, color: '#888', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                          ▼
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: QUESTION_COLORS[cat] || '#aaa' }}>{cat}</span>
                        <span style={{ fontSize: 11, color: '#666' }}>({items.length})</span>
                      </div>
                      {!collapsed && items.map(h => (
                        <div key={h.idx} style={{ marginLeft: 16, marginTop: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                            <div style={{ fontSize: 13, color: '#4285f4', fontWeight: 500 }}>Q: {h.question}</div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <span onClick={() => { setEditingQaIdx(h.idx); setEditingAnswer(h.answer); }} title="手动编辑答案"
                                style={{ fontSize: 12, cursor: 'pointer', color: '#888', padding: '2px 6px', borderRadius: 4, background: '#1c1f2e' }}>
                                ✏️
                              </span>
                              <span onClick={() => handleRegenerate(h.idx)} title="AI重新生成答案"
                                style={{ fontSize: 12, cursor: asking ? 'not-allowed' : 'pointer', color: '#888', padding: '2px 6px', borderRadius: 4, background: '#1c1f2e', opacity: asking ? 0.4 : 1 }}>
                                🔄
                              </span>
                            </div>
                          </div>
                          {editingQaIdx === h.idx ? (
                            <div>
                              <textarea value={editingAnswer} onChange={e => setEditingAnswer(e.target.value)}
                                style={{ width: '100%', minHeight: 120, padding: '8px 12px', borderRadius: 6, border: '1px solid #4285f4', background: '#1a1c28', color: '#ddd', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                <button onClick={() => handleSaveEditedAnswer(h.idx)}
                                  style={{ padding: '4px 12px', borderRadius: 4, border: 'none', background: '#34a853', color: '#fff', fontSize: 12, cursor: 'pointer' }}>保存</button>
                                <button onClick={() => { setEditingQaIdx(null); setEditingAnswer(''); }}
                                  style={{ padding: '4px 12px', borderRadius: 4, border: 'none', background: '#333', color: '#aaa', fontSize: 12, cursor: 'pointer' }}>取消</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 13, color: '#ccc', background: '#1a1c28', padding: '8px 12px', borderRadius: 6, border: '1px solid #2a2d35' }}>
                              {renderAnswer(h.answer)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Smart Questions */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>💡 深入学习</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {smartQuestions.length > 0 && (
                  <span onClick={() => {
                    const unanswered = smartQuestions.filter(q => !qaHistory.some(h => h.question === q.question && h.answer && !h.loading));
                    const allSelected = unanswered.every(q => selectedQs.has(q.id));
                    setSelectedQs(allSelected ? new Set() : new Set(unanswered.map(q => q.id)));
                  }} style={{ fontSize: 11, color: '#4285f4', cursor: 'pointer' }}>
                    {smartQuestions.filter(q => !qaHistory.some(h => h.question === q.question && h.answer && !h.loading)).every(q => selectedQs.has(q.id)) ? '取消全选' : '全选'}
                  </span>
                )}
                {!loadingQ && <span onClick={() => { delete questionsCacheRef.current[entry.id]; loadSmartQuestions(); }} style={{ fontSize: 11, color: '#4285f4', cursor: 'pointer' }}>重新生成问题</span>}
              </div>
            </div>

            {loadingQ ? (
              <div style={{ fontSize: 12, color: '#888', padding: 8 }}>正在生成智能问题...</div>
            ) : smartQuestions.length === 0 ? (
              <button onClick={loadSmartQuestions}
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px dashed #4285f444', background: '#4285f411', color: '#4285f4', cursor: 'pointer', fontSize: 13 }}>
                💡 生成智能问题
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(() => {
                  const unanswered = smartQuestions.filter(q => !qaHistory.some(h => h.question === q.question && h.answer && !h.loading));
                  if (unanswered.length === 0) return (
                    <div style={{ padding: 12, textAlign: 'center', color: '#666', fontSize: 12 }}>
                      所有问题已回答完毕！
                      {topicHTML ? (
                        newQaCount > 0 ? (
                          <button onClick={handleRefreshTopic} disabled={loadingTopic}
                            style={{ marginTop: 8, display: 'block', width: '100%', padding: '8px', borderRadius: 6, border: 'none', fontSize: 13,
                              background: '#9c27b033', color: '#ce93d8', cursor: loadingTopic ? 'wait' : 'pointer' }}>
                            {loadingTopic ? '更新中...' : `用新回答更新专题页`}
                          </button>
                        ) : <span> 点击「重新生成问题」获取新一批问题，或在下方添加自定义问题。</span>
                      ) : (
                        <button onClick={handleGenerateTopic} disabled={loadingTopic}
                          style={{ marginTop: 8, display: 'block', width: '100%', padding: '8px', borderRadius: 6, border: 'none', fontSize: 13,
                            background: '#34a85333', color: '#34a853', cursor: loadingTopic ? 'wait' : 'pointer' }}>
                          {loadingTopic ? '生成中...' : '根据回答生成专题页'}
                        </button>
                      )}
                    </div>
                  );
                  return unanswered.map(q => (
                  <div key={q.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <input type="checkbox" checked={selectedQs.has(q.id)} onChange={() => toggleQ(q.id)}
                      style={{ marginTop: 10, accentColor: QUESTION_COLORS[q.category] || '#4285f4', flexShrink: 0 }} />
                    {editingQIdx === q.id ? (
                      <div style={{ flex: 1, display: 'flex', gap: 4 }}>
                        <input value={editingQText} onChange={e => setEditingQText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEditQ(q.id); if (e.key === 'Escape') setEditingQIdx(null); }}
                          autoFocus style={{ ...inputStyle, flex: 1 }} />
                        <button onClick={() => saveEditQ(q.id)} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: '#34a853', color: '#fff', cursor: 'pointer', fontSize: 11 }}>✓</button>
                        <button onClick={() => setEditingQIdx(null)} style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: '#666', color: '#fff', cursor: 'pointer', fontSize: 11 }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: '#161822',
                        borderLeft: `3px solid ${QUESTION_COLORS[q.category] || '#666'}`, transition: 'background 0.15s', position: 'relative' }}
                        onClick={() => handleAsk(q.question)}
                        onMouseEnter={ev => ev.currentTarget.style.background = '#1c2030'}
                        onMouseLeave={ev => ev.currentTarget.style.background = '#161822'}>
                        <div style={{ fontSize: 13, color: q.answered ? '#888' : '#ddd', paddingRight: 40 }}>{q.question}</div>
                        <span style={{ fontSize: 10, color: QUESTION_COLORS[q.category] || '#888' }}>{q.category}</span>
                        {q.answered && <span style={{ fontSize: 10, color: '#34a853', marginLeft: 6 }}>✓ 已回答</span>}
                        <div style={{ position: 'absolute', right: 8, top: 8, display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                          <span onClick={() => { setEditingQIdx(q.id); setEditingQText(q.question); }} style={{ fontSize: 11, color: '#666', cursor: 'pointer' }}>✎</span>
                          <span onClick={() => deleteQ(q.id)} style={{ fontSize: 11, color: '#666', cursor: 'pointer' }}>×</span>
                        </div>
                      </div>
                    )}
                  </div>
                ));
                })()}
              </div>
            )}

            {selectedQs.size > 0 && (
              <button onClick={handleBatchAsk} disabled={asking}
                style={{ marginTop: 8, width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #4285f444',
                  background: '#4285f422', color: '#4285f4', cursor: asking ? 'wait' : 'pointer', fontSize: 12 }}>
                {asking ? '正在逐个提问...' : `批量提问选中的 ${selectedQs.size} 个问题`}
              </button>
            )}
          </div>

          {/* Add custom question to list */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <input value={newQuestion} onChange={e => setNewQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCustomQuestion(); }}
              placeholder="添加自定义问题到列表..."
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={addCustomQuestion} disabled={!newQuestion.trim()}
              style={{ padding: '8px 14px', borderRadius: 6, border: 'none', cursor: !newQuestion.trim() ? 'default' : 'pointer',
                background: '#34a853', color: '#fff', fontSize: 13, flexShrink: 0, opacity: !newQuestion.trim() ? 0.5 : 1 }}>
              +添加
            </button>
          </div>

          {/* Loading QAs */}
          {qaHistory.filter(h => h.loading).map((h, i) => (
            <div key={`loading_${i}`} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: '#4285f4', fontWeight: 500, marginBottom: 4 }}>❓ {h.question}</div>
              <div style={{ fontSize: 12, color: '#888', padding: 8 }}>AI 正在思考...</div>
            </div>
          ))}

          {/* Deep analysis entry — only for top-level entries */}
          {!entry.parent_id && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#161822', borderRadius: 8, border: '1px solid #2a2d35' }}>
              <button onClick={() => navigate(`/deep/${entry.id}`)}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #9c27b044',
                  background: '#9c27b022', color: '#ce93d8', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                🔬 深入分析 — 分解子主题并逐个探索
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
