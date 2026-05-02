import React, { useState, useEffect, useRef } from 'react';
import { deleteEntry, updateEntry, generateSmartQuestions, askEntryQuestion, generateTopicPage } from '../lib/api.js';

const QUESTION_COLORS = { '概念': '#4285f4', '原因': '#ea4335', '影响': '#34a853', '对比': '#fbbc05', '思考': '#9c27b0' };

export default function EntryDetail({ entry, allEntries = [], onClose, onDeleted, onNavigate, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('explore');
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
  const [loadingTopic, setLoadingTopic] = useState(false);
  const qaRef = useRef(null);

  useEffect(() => {
    setSmartQuestions([]);
    setSelectedQs(new Set());
    setQaHistory([]);
    setTopicHTML('');
    setTab('explore');
    setEditing(false);
    setEditingQIdx(null);
  }, [entry.id]);

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

  useEffect(() => { loadSmartQuestions(); }, [entry.id]);

  // Auto-generate default topic page once smart questions are loaded
  useEffect(() => {
    if (smartQuestions.length > 0 && !topicHTML && !loadingTopic) {
      handleGenerateTopic();
    }
  }, [smartQuestions]);

  const toggleQ = (id) => {
    setSelectedQs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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
    try {
      const data = await generateTopicPage(entry.id, qaHistory);
      setTopicHTML(data.html || '');
      if (tab !== 'explore') setTab('topic');
    } catch (err) { console.error(err); }
    setLoadingTopic(false);
  };

  const handleRefreshTopic = async () => {
    setLoadingTopic(true);
    try {
      const data = await generateTopicPage(entry.id, qaHistory);
      setTopicHTML(data.html || '');
    } catch (err) { console.error(err); }
    setLoadingTopic(false);
  };

  const startEdit = () => {
    setForm({ title: entry.title, content: entry.content, subject: entry.subject, tags: [...(entry.tags || [])] });
    setTagInput('');
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateEntry(entry.id, form);
      setEditing(false);
      if (onUpdated) onUpdated();
    } finally { setSaving(false); }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) setForm({ ...form, tags: [...form.tags, t] });
    setTagInput('');
  };

  const removeTag = (tag) => setForm({ ...form, tags: form.tags.filter(t => t !== tag) });

  const handleDelete = async () => { await deleteEntry(entry.id); onDeleted(); };

  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #2a2d45', background: '#1c1f2e', color: '#ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' };

  return (
    <div style={{ height: '100%', background: '#0f1117', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #2a2d35', background: '#161822' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#fff', flex: 1 }}>{entry.title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 22, padding: '0 4px' }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: '#888', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {entry.subject && <span style={{ background: '#2a2d45', padding: '2px 10px', borderRadius: 10 }}>{entry.subject}</span>}
          <span style={{ background: '#1c1f2e', padding: '2px 10px', borderRadius: 10 }}>{entry.created_date}</span>
          {(entry.tags || []).map((t, i) => (
            <span key={i} style={{ background: '#1c1f2e', padding: '2px 8px', borderRadius: 10, fontSize: 11, color: '#777' }}>#{t}</span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #2a2d35', background: '#161822' }}>
        {[{ id: 'explore', label: '🔍 探索' }, { id: 'topic', label: '📄 专题页' }, { id: 'edit', label: '✏️ 编辑' }].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id === 'edit') startEdit(); }}
            style={{ flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer', fontSize: 13,
              background: tab === t.id ? '#2a2d45' : 'transparent', color: tab === t.id ? '#fff' : '#777',
              borderBottom: tab === t.id ? '2px solid #4285f4' : '2px solid transparent' }}>
            {t.label}
            {t.id === 'topic' && topicHTML && <span style={{ fontSize: 10, marginLeft: 4, color: '#34a853' }}>●</span>}
          </button>
        ))}
      </div>

      {/* Explore Tab */}
      {tab === 'explore' && (
        <div ref={qaRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {/* Content */}
          <div style={{ fontSize: 14, lineHeight: 1.8, color: '#ddd', background: '#161822', padding: '14px 16px', borderRadius: 8, marginBottom: 16, border: '1px solid #2a2d35' }}>
            {entry.content}
          </div>

          {/* Smart Questions — editable, selectable */}
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
                        <div style={{ position: 'absolute', right: 8, top: 8, display: 'flex', gap: 4 }}
                          onClick={e => e.stopPropagation()}>
                          <span onClick={() => { setEditingQIdx(q.id); setEditingQText(q.question); }}
                            style={{ fontSize: 11, color: '#666', cursor: 'pointer' }} title="编辑">✎</span>
                          <span onClick={() => deleteQ(q.id)}
                            style={{ fontSize: 11, color: '#666', cursor: 'pointer' }} title="删除">×</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add custom question */}
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <input value={newQuestion} onChange={e => setNewQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustomQuestion(); }}
                placeholder="添加自定义问题..."
                style={{ ...inputStyle, flex: 1, fontSize: 12 }} />
              <button onClick={addCustomQuestion} disabled={!newQuestion.trim()}
                style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#34a853', color: '#fff', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>+</button>
            </div>

            {/* Batch ask selected */}
            {selectedQs.size > 0 && (
              <button onClick={handleBatchAsk} disabled={asking}
                style={{ marginTop: 8, width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #4285f444',
                  background: '#4285f422', color: '#4285f4', cursor: asking ? 'wait' : 'pointer', fontSize: 12 }}>
                {asking ? '正在逐个提问...' : `批量提问选中的 ${selectedQs.size} 个问题`}
              </button>
            )}
          </div>

          {/* Custom question input */}
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

          {/* Q&A History */}
          {qaHistory.map((h, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: '#4285f4', fontWeight: 500, marginBottom: 4 }}>❓ {h.question}</div>
              {h.loading ? (
                <div style={{ fontSize: 12, color: '#888', padding: 8 }}>AI 正在思考...</div>
              ) : (
                <div style={{ fontSize: 13, lineHeight: 1.8, color: '#ccc', background: '#161822', padding: '12px 16px', borderRadius: 8, border: '1px solid #2a2d35' }}>
                  {h.answer}
                </div>
              )}
            </div>
          ))}

          {/* Refresh topic page after new Q&A */}
          {qaHistory.length > 0 && topicHTML && (
            <button onClick={handleRefreshTopic} disabled={loadingTopic}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #9c27b044',
                background: loadingTopic ? '#333' : '#9c27b022', color: '#ce93d8', cursor: loadingTopic ? 'wait' : 'pointer',
                fontSize: 13, marginBottom: 12 }}>
              {loadingTopic ? '正在更新专题页面...' : '🔄 用新的问答更新专题页面'}
            </button>
          )}

          {/* Actions */}
          <div style={{ borderTop: '1px solid #2a2d35', paddingTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={() => { setTab('edit'); startEdit(); }}
              style={{ padding: '6px 14px', background: '#4285f422', color: '#4285f4', border: '1px solid #4285f444', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              编辑
            </button>
            <button onClick={handleDelete}
              style={{ padding: '6px 14px', background: '#d32f2f22', color: '#ef5350', border: '1px solid #d32f2f44', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              删除
            </button>
          </div>
        </div>
      )}

      {/* Edit Tab */}
      {tab === 'edit' && editing && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>标题</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>学科分类</label>
            <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>内容</label>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={10}
              style={{ ...inputStyle, lineHeight: 1.8, resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>标签</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {form.tags.map((t, i) => (
                <span key={i} style={{ background: '#2a2d45', padding: '2px 8px', borderRadius: 10, fontSize: 11, color: '#bbb', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  #{t}
                  <span onClick={() => removeTag(t)} style={{ cursor: 'pointer', color: '#ef5350', fontWeight: 700 }}>×</span>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="添加标签..." style={{ ...inputStyle, flex: 1 }} />
              <button onClick={addTag} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#4285f4', color: '#fff', cursor: 'pointer', fontSize: 12 }}>+</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '8px 20px', background: '#4285f4', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
              {saving ? '保存中...' : '保存'}
            </button>
            <button onClick={() => { setEditing(false); setTab('explore'); }}
              style={{ padding: '8px 20px', background: '#1c1f2e', color: '#aaa', border: '1px solid #2a2d45', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* Topic Page Tab */}
      {tab === 'topic' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {loadingTopic && !topicHTML ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
              正在自动生成专题页面...
            </div>
          ) : topicHTML ? (
            <>
              <div style={{ padding: '6px 16px', borderBottom: '1px solid #2a2d35', display: 'flex', justifyContent: 'flex-end', gap: 6, background: '#161822' }}>
                <button onClick={handleRefreshTopic} disabled={loadingTopic}
                  style={{ padding: '4px 12px', borderRadius: 4, border: 'none', background: loadingTopic ? '#333' : '#9c27b033', color: '#ce93d8', cursor: loadingTopic ? 'wait' : 'pointer', fontSize: 11 }}>
                  {loadingTopic ? '更新中...' : '🔄 更新'}
                </button>
              </div>
              <iframe srcDoc={topicHTML} style={{ flex: 1, border: 'none', background: '#0f1117' }} title="知识专题" />
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 48 }}>📄</div>
              <div style={{ fontSize: 14, color: '#888' }}>正在等待智能问题生成...</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
