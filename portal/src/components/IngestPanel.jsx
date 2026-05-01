import React, { useState } from 'react';
import { ingestText } from '../lib/api.js';

export default function IngestPanel({ onIngested, loading, setLoading }) {
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');

  const handleSubmit = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      await ingestText(text.trim(), subject.trim());
      setText('');
      onIngested();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2d35' }}>
      <input
        value={subject}
        onChange={e => setSubject(e.target.value)}
        placeholder="学科 (可选)"
        style={{ width: '100%', padding: '6px 10px', marginBottom: 8, background: '#1c1f2e', border: '1px solid #2a2d35', borderRadius: 6, color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
      />
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="粘贴笔记内容..."
        rows={5}
        style={{ width: '100%', padding: '8px 10px', background: '#1c1f2e', border: '1px solid #2a2d35', borderRadius: 6, color: '#e0e0e0', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
      />
      <button
        onClick={handleSubmit}
        disabled={!text.trim() || loading}
        style={{ width: '100%', marginTop: 8, padding: '8px 0', background: loading ? '#555' : '#4285f4', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
      >
        {loading ? '分析中...' : '📥 添加知识'}
      </button>
    </div>
  );
}
