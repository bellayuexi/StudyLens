import React, { useState, useEffect, useRef } from 'react';
import { deleteEntry, updateEntry, generateSmartQuestions, askEntryQuestion, generateTopicPage } from '../lib/api.js';

const QUESTION_COLORS = { '概念': '#4285f4', '原因': '#ea4335', '影响': '#34a853', '对比': '#fbbc05', '思考': '#9c27b0' };

export default function EntryDetail({ entry, connectedEntries = [], onClose, onDeleted, onNavigate, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('explore');
  const [smartQuestions, setSmartQuestions] = useState([]);
  const [loadingQ, setLoadingQ] = useState(false);
  const [customQ, setCustomQ] = useState('');
  const [qaHistory, setQaHistory] = useState([]);
  const [asking, setAsking] = useState(false);
  const [topicHTML, setTopicHTML] = useState('');
  const [loadingTopic, setLoadingTopic] = useState(false);
  const qaRef = useRef(null);

  useEffect(() => {
    setSmartQuestions([]);
    setQaHistory([]);
    setTopicHTML('');
    setTab('explore');
    setEditing(false);
  }, [entry.id]);

  const loadSmartQuestions = async () => {
    setLoadingQ(true);
    try {
      const data = await generateSmartQuestions(entry.id);
      setSmartQuestions(data.questions || []);
    } catch (e) { console.error(e); }
    setLoadingQ(false);
  };

  useEffect(() => { loadSmartQuestions(); }, [entry.id]);

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

  const handleGenerateTopic = async () => {
    setLoadingTopic(true);
    try {
      const data = await generateTopicPage(entry.id, qaHistory);
      setTopicHTML(data.html || '');
      setTab('topic');
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

  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #2a2d45', background: '#1c1f2e', color: '#ddd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' };

  return (
    <div style={{ width: 480, borderLeft: '1px solid #2a2d35', background: '#161822', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #2a2d35' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#fff', flex: 1 }}>{entry.title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20, padding: '0 4px' }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: '#888', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {entry.subject && <span style={{ background: '#2a2d45', padding: '2px 8px', borderRadius: 10 }}>{entry.subject}</span>}
          <span style={{ background: '#1c1f2e', padding: '2px 8px', borderRadius: 10 }}>{entry.created_date}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #2a2d35' }}>
        {[{ id: 'explore', label: '🔍 探索' }, { id: 'edit', label: '✏️ 编辑' }, { id: 'topic', label: '📄 专题页' }].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id === 'edit') startEdit(); }}
            style={{ flex: 1, padding: '8px 4px', border: 'none', cursor: 'pointer', fontSize: 12,
              background: tab === t.id ? '#2a2d45' : 'transparent', color: tab === t.id ? '#fff' : '#777',
              borderBottom: tab === t.id ? '2px solid #4285f4' : '2px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Explore Tab */}
      {tab === 'explore' && (
        <div ref={qaRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
          {/* Content */}
          <div style={{ fontSize: 14, lineHeight: 1.8, color: '#ddd', background: '#1c1f2e', padding: '12px 14px', borderRadius: 8, marginBottom: 14 }}>
            {entry.content}
          </div>

          {/* Tags */}
          {(entry.tags || []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
              {entry.tags.map((t, i) => (
                <span key={i} style={{ background: '#2a2d45', padding: '2px 8px', borderRadius: 10, fontSize: 11, color: '#bbb' }}>#{t}</span>
              ))}
            </div>
          )}

          {/* Smart Questions */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>💡 深入学习</span>
              {!loadingQ && <span onClick={loadSmartQuestions} style={{ fontSize: 11, color: '#4285f4', cursor: 'pointer' }}>刷新问题</span>}
            </div>
            {loadingQ ? (
              <div style={{ fontSize: 12, color: '#888', padding: 8 }}>正在生成智能问题...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {smartQuestions.map((q, i) => (
                  <div key={i} onClick={() => handleAsk(q.question)}
                    style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: '#1c1f2e',
                      borderLeft: `3px solid ${QUESTION_COLORS[q.category] || '#666'}`, transition: 'background 0.15s' }}
                    onMouseEnter={ev => ev.currentTarget.style.background = '#222640'}
                    onMouseLeave={ev => ev.currentTarget.style.background = '#1c1f2e'}>
                    <div style={{ fontSize: 13, color: '#ddd' }}>{q.question}</div>
                    <span style={{ fontSize: 10, color: QUESTION_COLORS[q.category] || '#888' }}>{q.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom question input */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <input value={customQ} onChange={e => setCustomQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAsk(customQ.trim()); }}
              placeholder="输入你的问题..."
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => handleAsk(customQ.trim())} disabled={asking || !customQ.trim()}
              style={{ padding: '8px 14px', borderRadius: 6, border: 'none', cursor: asking ? 'wait' : 'pointer',
                background: '#4285f4', color: '#fff', fontSize: 13, flexShrink: 0 }}>
              提问
            </button>
          </div>

          {/* Q&A History */}
          {qaHistory.map((h, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#4285f4', fontWeight: 500, marginBottom: 4 }}>❓ {h.question}</div>
              {h.loading ? (
                <div style={{ fontSize: 12, color: '#888', padding: 8 }}>AI 正在思考...</div>
              ) : (
                <div style={{ fontSize: 13, lineHeight: 1.8, color: '#ccc', background: '#1c1f2e', padding: '10px 14px', borderRadius: 8 }}>
                  {h.answer}
                </div>
              )}
              {h.cards?.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {h.cards.map((c, j) => (
                    <span key={j} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: '#9c27b033', color: '#ce93d8' }}>
                      {c.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Generate topic page button */}
          {qaHistory.length > 0 && (
            <button onClick={handleGenerateTopic} disabled={loadingTopic}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #9c27b044',
                background: loadingTopic ? '#333' : '#9c27b022', color: '#ce93d8', cursor: loadingTopic ? 'wait' : 'pointer',
                fontSize: 13, marginBottom: 12 }}>
              {loadingTopic ? '正在生成专题页面...' : '📄 生成知识专题页面'}
            </button>
          )}

          {/* Actions */}
          <div style={{ borderTop: '1px solid #2a2d35', paddingTop: 10, display: 'flex', gap: 6 }}>
            <button onClick={() => { setTab('edit'); startEdit(); }}
              style={{ padding: '5px 12px', background: '#4285f422', color: '#4285f4', border: '1px solid #4285f444', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>
              编辑
            </button>
            <button onClick={handleDelete}
              style={{ padding: '5px 12px', background: '#d32f2f22', color: '#ef5350', border: '1px solid #d32f2f44', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>
              删除
            </button>
          </div>
        </div>
      )}

      {/* Edit Tab */}
      {tab === 'edit' && editing && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>标题</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>学科分类</label>
            <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>内容</label>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={8}
              style={{ ...inputStyle, lineHeight: 1.8, resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: 14 }}>
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
          {topicHTML ? (
            <iframe srcDoc={topicHTML} style={{ flex: 1, border: 'none', background: '#0f1117' }} title="知识专题" />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 48 }}>📄</div>
              <div style={{ fontSize: 14, color: '#888' }}>还没有生成专题页面</div>
              <div style={{ fontSize: 12, color: '#666' }}>先在"探索"标签中提问，然后点击生成</div>
              <button onClick={handleGenerateTopic} disabled={loadingTopic}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: loadingTopic ? '#333' : '#9c27b0', color: '#fff', cursor: loadingTopic ? 'wait' : 'pointer', fontSize: 13 }}>
                {loadingTopic ? '生成中...' : '直接生成专题页面'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
