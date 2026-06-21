import React, { useState } from 'react';
import { ingestText, addManualEntry } from '../lib/api.js';

export default function IngestPanel({ onIngested, loading, setLoading }) {
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');
  const [maxPoints, setMaxPoints] = useState('');
  const [addMode, setAddMode] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [result, setResult] = useState(null);

  const inputStyle = { width: '100%', padding: '6px 10px', background: '#1c1f2e', border: '1px solid #2a2d35', borderRadius: 6, color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' };

  const handleAnalyze = async () => {
    if (loading || !text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const mp = maxPoints ? parseInt(maxPoints, 10) : undefined;
      const res = await ingestText(text.trim(), subject.trim(), mp);
      setText('');
      setResult({ ok: true, count: res.created?.length || 0, skipped: res.skipped || [] });
      onIngested();
    } catch (err) {
      setResult({ ok: false, msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAddManual = async () => {
    if (loading || !title.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const tagList = tags.split(/[,，]/).map(t => t.trim()).filter(Boolean);
      await addManualEntry({ title: title.trim(), content: content.trim(), subject: subject.trim(), tags: tagList });
      setTitle(''); setContent(''); setTags('');
      setResult({ ok: true, manual: true });
      onIngested();
    } catch (err) {
      setResult({ ok: false, msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2d35' }}>
      <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="学科 (可选)"
        style={{ ...inputStyle, marginBottom: 8 }} />

      <input type="number" min="1" max="50" value={maxPoints} onChange={e => setMaxPoints(e.target.value)} placeholder="最多提取知识点数 (可选)"
        style={{ ...inputStyle, marginBottom: 8 }} />

      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="粘贴笔记内容..." rows={4}
        style={{ ...inputStyle, resize: 'vertical' }} />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={handleAnalyze} disabled={!text.trim() || loading}
          style={{ flex: 1, padding: '8px 0', background: loading ? '#555' : '#4285f4', color: '#fff',
            border: 'none', borderRadius: 6, cursor: (!text.trim() || loading) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}>
          {loading ? 'AI拆解中...' : '🤖 AI拆解'}
        </button>
        <button onClick={() => setAddMode(!addMode)} disabled={loading}
          style={{ padding: '8px 14px', background: '#34a85322', color: '#34a853',
            border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13 }}>
          + 手动添加
        </button>
      </div>

      {/* Manual add form */}
      {addMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid #2a2d35' }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="标题 (必填)" style={inputStyle} />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="内容 (可选)" rows={3}
            style={{ ...inputStyle, resize: 'vertical' }} />
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="标签 (可选，逗号分隔)" style={inputStyle} />
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={handleAddManual} disabled={!title.trim() || loading}
              style={{ flex: 1, padding: '6px', borderRadius: 4, border: 'none', background: '#34a853', color: '#fff',
                cursor: (!title.trim() || loading) ? 'not-allowed' : 'pointer', fontSize: 12 }}>
              {loading ? '添加中...' : '✍️ 添加知识点'}
            </button>
            <button onClick={() => setAddMode(false)}
              style={{ padding: '6px 12px', borderRadius: 4, border: 'none', background: '#333', color: '#aaa', cursor: 'pointer', fontSize: 12 }}>取消</button>
          </div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 6, fontSize: 12, color: result.ok ? '#34a853' : '#ef5350' }}>
          {result.ok ? (result.manual ? '已添加知识点' : `成功提取 ${result.count} 个知识点`) : `错误: ${result.msg}`}
          {result.skipped?.length > 0 && (
            <div style={{ marginTop: 4, color: '#ffb74d' }}>
              跳过 {result.skipped.length} 个重复知识点:
              {result.skipped.map((s, i) => (
                <div key={i} style={{ marginLeft: 8, fontSize: 11, color: '#999' }}>
                  • {s.title} — 与「{s.duplicateTitle}」重复: {s.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
