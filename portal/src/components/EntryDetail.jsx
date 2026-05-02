import React, { useState, useEffect, useRef, useCallback } from 'react';
import { deleteEntry, updateEntry, generateSmartQuestions, askEntryQuestion, generateTopicPage, saveTopicPage, getLatestTopicPage, updateTopicPageComments } from '../lib/api.js';

const QUESTION_COLORS = { '概念': '#4285f4', '原因': '#ea4335', '影响': '#34a853', '对比': '#fbbc05', '思考': '#9c27b0', '自定义': '#ff6d00' };

export default function EntryDetail({ entry, allEntries = [], onClose, onDeleted, onNavigate, onUpdated }) {
  const [tab, setTab] = useState('topic');
  const [smartQuestions, setSmartQuestions] = useState([]);
  const [selectedQs, setSelectedQs] = useState(new Set());
  const [loadingQ, setLoadingQ] = useState(false);
  const [editingQIdx, setEditingQIdx] = useState(null);
  const [editingQText, setEditingQText] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [customQ, setCustomQ] = useState('');
  const [qaHistory, setQaHistory] = useState([]);
  const [asking, setAsking] = useState(false);
  const [topicHTML, setTopicHTML] = useState('');
  const [topicPageId, setTopicPageId] = useState(null);
  const [topicVersion, setTopicVersion] = useState(0);
  const [loadingTopic, setLoadingTopic] = useState(false);
  const [topicStatus, setTopicStatus] = useState('');
  const [comments, setComments] = useState([]);
  const [commentMode, setCommentMode] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [editingField, setEditingField] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const qaRef = useRef(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    setSmartQuestions([]);
    setSelectedQs(new Set());
    setQaHistory([]);
    setTopicHTML('');
    setTopicPageId(null);
    setTopicVersion(0);
    setTopicStatus('');
    setComments([]);
    setCommentMode(false);
    setEditingField(null);
    setTab('topic');
    loadSavedTopicPage();
    loadSmartQuestions();
  }, [entry.id]);

  const loadSavedTopicPage = async () => {
    try {
      const data = await getLatestTopicPage(entry.id);
      if (data.page) {
        setTopicHTML(data.page.html);
        setTopicPageId(data.page.id);
        setTopicVersion(data.page.version);
        setComments(data.page.comments || []);
        setQaHistory(data.page.qa_history || []);
        setTopicStatus(`v${data.page.version} 已保存`);
      }
    } catch (e) { console.error(e); }
  };

  const loadSmartQuestions = async () => {
    setLoadingQ(true);
    try {
      const data = await generateSmartQuestions(entry.id);
      const qs = (data.questions || []).map((q, i) => ({ ...q, id: i }));
      setSmartQuestions(qs);
      setSelectedQs(new Set(qs.map(q => q.id)));
    } catch (e) { console.error(e); }
    setLoadingQ(false);
  };

  // Auto-generate topic page if none saved and questions loaded
  useEffect(() => {
    if (smartQuestions.length > 0 && !topicHTML && !loadingTopic && topicVersion === 0) {
      handleGenerateTopic();
    }
  }, [smartQuestions]);

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
    setAsking(true);
    setCustomQ('');
    const history = qaHistory.map(h => ({ question: h.question, answer: h.answer }));
    setQaHistory(prev => [...prev, { question, answer: '', loading: true }]);
    try {
      const data = await askEntryQuestion(entry.id, question, history);
      setQaHistory(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { question, answer: data.answer, cards: data.suggestedCards || [], loading: false };
        return updated;
      });
    } catch (err) {
      setQaHistory(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { question, answer: `错误: ${err.message}`, loading: false };
        return updated;
      });
    }
    setAsking(false);
    setTimeout(() => qaRef.current?.scrollTo(0, qaRef.current.scrollHeight), 100);
  };

  const handleBatchAsk = async () => {
    const selected = smartQuestions.filter(q => selectedQs.has(q.id));
    if (!selected.length || asking) return;
    for (const q of selected) {
      await handleAsk(q.question);
    }
  };

  const handleGenerateTopic = async () => {
    setLoadingTopic(true);
    setTopicStatus('正在生成...');
    try {
      const data = await generateTopicPage(entry.id, qaHistory);
      const html = data.html || '';
      setTopicHTML(html);
      // Auto-save
      const saved = await saveTopicPage(entry.id, html, qaHistory, comments);
      setTopicPageId(saved.id);
      setTopicVersion(saved.version);
      setTopicStatus(`v${saved.version} 已保存`);
      setTab('topic');
    } catch (err) {
      setTopicStatus('生成失败');
      console.error(err);
    }
    setLoadingTopic(false);
  };

  const handleRefreshTopic = async () => {
    setLoadingTopic(true);
    setTopicStatus('正在更新...');
    try {
      const data = await generateTopicPage(entry.id, qaHistory);
      const html = data.html || '';
      setTopicHTML(html);
      const saved = await saveTopicPage(entry.id, html, qaHistory, comments);
      setTopicPageId(saved.id);
      setTopicVersion(saved.version);
      setTopicStatus(`v${saved.version} 已保存`);
    } catch (err) {
      setTopicStatus('更新失败');
      console.error(err);
    }
    setLoadingTopic(false);
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

  const handleApplyComments = async () => {
    if (!comments.length) return;
    setLoadingTopic(true);
    setTopicStatus('根据批注更新中...');
    try {
      const commentText = comments.map(c => c.text).join('\n');
      const augmentedHistory = [...qaHistory, { question: `请根据以下批注修改专题页面:\n${commentText}`, answer: '' }];
      const data = await generateTopicPage(entry.id, augmentedHistory);
      const html = data.html || '';
      setTopicHTML(html);
      const saved = await saveTopicPage(entry.id, html, qaHistory, []);
      setTopicPageId(saved.id);
      setTopicVersion(saved.version);
      setComments([]);
      setTopicStatus(`v${saved.version} 已保存（已应用批注）`);
    } catch (err) {
      setTopicStatus('应用批注失败');
    }
    setLoadingTopic(false);
  };

  // Inline editing
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
    } finally { setSaving(false); }
  };

  const handleDelete = async () => { await deleteEntry(entry.id); onDeleted(); };

  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #2a2d45', background: '#1c1f2e', color: '#ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' };

  const renderAnswer = (text) => {
    if (!text) return null;
    return text.split('\n').filter(Boolean).map((para, i) => (
      <p key={i} style={{ margin: '6px 0', lineHeight: 1.8 }}>{para}</p>
    ));
  };

  return (
    <div style={{ height: '100%', background: '#0f1117', display: 'flex', flexDirection: 'column' }}>
      {/* Header — inline editable */}
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

      {/* Tabs: Topic Page first */}
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
          </button>
        ))}
      </div>

      {/* Topic Page Tab */}
      {tab === 'topic' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Toolbar */}
          <div style={{ padding: '6px 16px', borderBottom: '1px solid #2a2d35', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#161822', flexWrap: 'wrap', gap: 4 }}>
            <div style={{ fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{topicStatus || (loadingTopic ? '生成中...' : '未生成')}</span>
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
              <button onClick={handleRefreshTopic} disabled={loadingTopic}
                style={{ padding: '3px 10px', borderRadius: 4, border: 'none', fontSize: 11, cursor: loadingTopic ? 'wait' : 'pointer',
                  background: loadingTopic ? '#333' : '#4285f422', color: '#4285f4' }}>
                {loadingTopic ? '更新中...' : '🔄 重新生成'}
              </button>
            </div>
          </div>

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
                  placeholder="例如: 第二章需要扩充更多细节 / 删除重复段落 / 加入更多历史背景..."
                  style={{ ...inputStyle, flex: 1, fontSize: 12 }} />
                <button onClick={addComment} disabled={!newComment.trim()}
                  style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#fbbc05', color: '#000', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>+</button>
              </div>
            </div>
          )}

          {/* Content */}
          {loadingTopic && !topicHTML ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
              正在自动生成专题页面...
            </div>
          ) : topicHTML ? (
            <iframe ref={iframeRef} srcDoc={topicHTML} style={{ flex: 1, border: 'none', background: '#0f1117' }} title="知识专题" />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#666' }}>
              <div style={{ fontSize: 48 }}>📄</div>
              <div style={{ fontSize: 14 }}>正在等待智能问题生成...</div>
            </div>
          )}
        </div>
      )}

      {/* Explore Tab */}
      {tab === 'explore' && (
        <div ref={qaRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {/* Content preview */}
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

          {/* Smart Questions */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>💡 深入学习</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {smartQuestions.length > 0 && (
                  <span onClick={() => {
                    const allSelected = smartQuestions.every(q => selectedQs.has(q.id));
                    setSelectedQs(allSelected ? new Set() : new Set(smartQuestions.map(q => q.id)));
                  }} style={{ fontSize: 11, color: '#4285f4', cursor: 'pointer' }}>
                    {smartQuestions.every(q => selectedQs.has(q.id)) ? '取消全选' : '全选'}
                  </span>
                )}
                {!loadingQ && <span onClick={loadSmartQuestions} style={{ fontSize: 11, color: '#4285f4', cursor: 'pointer' }}>刷新</span>}
              </div>
            </div>

            {loadingQ ? (
              <div style={{ fontSize: 12, color: '#888', padding: 8 }}>正在生成智能问题...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {smartQuestions.map(q => (
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
                        <div style={{ fontSize: 13, color: '#ddd', paddingRight: 40 }}>{q.question}</div>
                        <span style={{ fontSize: 10, color: QUESTION_COLORS[q.category] || '#888' }}>{q.category}</span>
                        <div style={{ position: 'absolute', right: 8, top: 8, display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                          <span onClick={() => { setEditingQIdx(q.id); setEditingQText(q.question); }} style={{ fontSize: 11, color: '#666', cursor: 'pointer' }}>✎</span>
                          <span onClick={() => deleteQ(q.id)} style={{ fontSize: 11, color: '#666', cursor: 'pointer' }}>×</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <input value={newQuestion} onChange={e => setNewQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustomQuestion(); }}
                placeholder="添加自定义问题..."
                style={{ ...inputStyle, flex: 1, fontSize: 12 }} />
              <button onClick={addCustomQuestion} disabled={!newQuestion.trim()}
                style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#34a853', color: '#fff', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>+</button>
            </div>

            {selectedQs.size > 0 && (
              <button onClick={handleBatchAsk} disabled={asking}
                style={{ marginTop: 8, width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #4285f444',
                  background: '#4285f422', color: '#4285f4', cursor: asking ? 'wait' : 'pointer', fontSize: 12 }}>
                {asking ? '正在逐个提问...' : `批量提问选中的 ${selectedQs.size} 个问题`}
              </button>
            )}
          </div>

          {/* Direct question */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <input value={customQ} onChange={e => setCustomQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAsk(customQ.trim()); }}
              placeholder="直接提问..."
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => handleAsk(customQ.trim())} disabled={asking || !customQ.trim()}
              style={{ padding: '8px 14px', borderRadius: 6, border: 'none', cursor: asking ? 'wait' : 'pointer',
                background: '#4285f4', color: '#fff', fontSize: 13, flexShrink: 0 }}>
              提问
            </button>
          </div>

          {/* Q&A History with formatted answers */}
          {qaHistory.map((h, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: '#4285f4', fontWeight: 500, marginBottom: 4 }}>❓ {h.question}</div>
              {h.loading ? (
                <div style={{ fontSize: 12, color: '#888', padding: 8 }}>AI 正在思考...</div>
              ) : (
                <div style={{ fontSize: 13, color: '#ccc', background: '#161822', padding: '12px 16px', borderRadius: 8, border: '1px solid #2a2d35' }}>
                  {renderAnswer(h.answer)}
                </div>
              )}
            </div>
          ))}

          {/* Update topic page with new Q&A */}
          {qaHistory.length > 0 && topicHTML && (
            <button onClick={handleRefreshTopic} disabled={loadingTopic}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #9c27b044',
                background: loadingTopic ? '#333' : '#9c27b022', color: '#ce93d8', cursor: loadingTopic ? 'wait' : 'pointer',
                fontSize: 13, marginBottom: 12 }}>
              {loadingTopic ? '正在更新专题页面...' : '🔄 用新的问答更新专题页面'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
