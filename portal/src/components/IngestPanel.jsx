import React, { useState, useRef } from 'react';
import { ingestText, ingestFile, ingestUrl } from '../lib/api.js';

const TABS = [
  { id: 'text', label: '📝 文本' },
  { id: 'file', label: '📄 文件' },
  { id: 'url', label: '🔗 网页' },
];

const ACCEPT = '.pdf,.docx,.xlsx,.xls,.txt,.md';

export default function IngestPanel({ onIngested, loading, setLoading }) {
  const [tab, setTab] = useState('text');
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');
  const [url, setUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef(null);
  const [result, setResult] = useState(null);

  const inputStyle = { width: '100%', padding: '6px 10px', background: '#1c1f2e', border: '1px solid #2a2d35', borderRadius: 6, color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' };

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    setResult(null);
    try {
      let res;
      if (tab === 'text') {
        if (!text.trim()) return;
        res = await ingestText(text.trim(), subject.trim());
        setText('');
      } else if (tab === 'file') {
        const file = fileRef.current?.files?.[0];
        if (!file) return;
        res = await ingestFile(file, subject.trim());
        fileRef.current.value = '';
        setFileName('');
      } else if (tab === 'url') {
        if (!url.trim()) return;
        res = await ingestUrl(url.trim(), subject.trim());
        setUrl('');
      }
      setResult({ ok: true, count: res.created?.length || 0 });
      onIngested();
    } catch (err) {
      setResult({ ok: false, msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = tab === 'text' ? text.trim() : tab === 'file' ? fileName : tab === 'url' ? url.trim() : false;

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2d35' }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: '4px 0', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11,
              background: tab === t.id ? '#2a2d45' : 'transparent', color: tab === t.id ? '#fff' : '#777' }}>
            {t.label}
          </button>
        ))}
      </div>

      <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="学科 (可选)"
        style={{ ...inputStyle, marginBottom: 8 }} />

      {tab === 'text' && (
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="粘贴笔记内容..." rows={4}
          style={{ ...inputStyle, resize: 'vertical' }} />
      )}

      {tab === 'file' && (
        <div style={{ ...inputStyle, padding: '10px', cursor: 'pointer', textAlign: 'center', borderStyle: 'dashed' }}
          onClick={() => fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept={ACCEPT} style={{ display: 'none' }}
            onChange={e => setFileName(e.target.files?.[0]?.name || '')} />
          {fileName
            ? <span style={{ color: '#4285f4' }}>{fileName}</span>
            : <span style={{ color: '#666' }}>点击选择文件 (PDF / Word / Excel / TXT)</span>
          }
        </div>
      )}

      {tab === 'url' && (
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
      )}

      <button onClick={handleSubmit} disabled={!canSubmit || loading}
        style={{ width: '100%', marginTop: 8, padding: '8px 0', background: loading ? '#555' : '#4285f4', color: '#fff',
          border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}>
        {loading ? '分析中...' : '📥 添加知识'}
      </button>

      {result && (
        <div style={{ marginTop: 6, fontSize: 12, color: result.ok ? '#34a853' : '#ef5350' }}>
          {result.ok ? `成功提取 ${result.count} 个知识点` : `错误: ${result.msg}`}
        </div>
      )}
    </div>
  );
}
