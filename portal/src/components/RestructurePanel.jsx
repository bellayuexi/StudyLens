import React, { useState } from 'react';
import { restructureGraph } from '../lib/api.js';

export default function RestructurePanel({ subjects, onRestructured }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [scope, setScope] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await restructureGraph(input.trim(), scope);
      setResult({ ok: true, msg: `已调整 ${data.total} 个知识点`, changes: data.changes });
      setInput('');
      if (data.total > 0 && onRestructured) onRestructured();
    } catch (err) {
      setResult({ ok: false, msg: err.message });
    } finally { setLoading(false); }
  };

  if (!open) {
    return (
      <div onClick={() => setOpen(true)}
        style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, background: 'rgba(22,24,34,0.92)',
          padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#aaa',
          border: '1px solid #2a2d45', transition: 'all 0.2s' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#4285f4'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2d45'; e.currentTarget.style.color = '#aaa'; }}>
        🔧 调整知识结构
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, background: 'rgba(22,24,34,0.96)',
      padding: '14px 16px', borderRadius: 10, border: '1px solid #4285f4', width: 340, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>🔧 调整知识结构</span>
        <span onClick={() => { setOpen(false); setResult(null); }}
          style={{ cursor: 'pointer', color: '#666', fontSize: 16 }}>✕</span>
      </div>

      <div style={{ fontSize: 11, color: '#888', marginBottom: 8, lineHeight: 1.5 }}>
        用自然语言描述你想要的调整，例如：
        <br />· "把宋朝拆分成北宋和南宋"
        <br />· "合并所有跟科举有关的知识点"
        <br />· "把经济类的知识从唐朝移到专门的经济分类"
      </div>

      {subjects.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>调整范围：</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <span onClick={() => setScope('')}
              style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
                background: !scope ? '#4285f4' : '#1c1f2e', color: !scope ? '#fff' : '#888' }}>全部</span>
            {subjects.map(s => (
              <span key={s} onClick={() => setScope(s === scope ? '' : s)}
                style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
                  background: s === scope ? '#4285f4' : '#1c1f2e', color: s === scope ? '#fff' : '#888' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <textarea value={input} onChange={e => setInput(e.target.value)}
        placeholder="描述你想要的知识结构调整..."
        style={{ width: '100%', height: 60, padding: '8px 10px', borderRadius: 6, border: '1px solid #2a2d45',
          background: '#1c1f2e', color: '#ddd', fontSize: 13, resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />

      <button onClick={handleSubmit} disabled={loading || !input.trim()}
        style={{ width: '100%', padding: '8px', borderRadius: 6, border: 'none', marginTop: 6,
          cursor: loading ? 'wait' : 'pointer',
          background: loading ? '#333' : '#4285f4', color: '#fff', fontSize: 13 }}>
        {loading ? 'AI 正在调整...' : '执行调整'}
      </button>

      {result && (
        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, fontSize: 12,
          background: result.ok ? '#1a2e1a' : '#2e1a1a', color: result.ok ? '#4caf50' : '#ef5350' }}>
          {result.msg}
          {result.changes?.map((c, i) => (
            <div key={i} style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>
              {c.action === 'update' && `✏️ ${c.title} → ${c.subject}`}
              {c.action === 'merge' && `🔗 合并 ${c.ids.length} 个条目 → ${c.title}`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
