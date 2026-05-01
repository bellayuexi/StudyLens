import React from 'react';
import { deleteEntry } from '../lib/api.js';

export default function EntryDetail({ entry, connectedEntries = [], onClose, onDeleted, onNavigate }) {
  const handleDelete = async () => {
    await deleteEntry(entry.id);
    onDeleted();
  };

  return (
    <div style={{ width: 360, borderLeft: '1px solid #2a2d35', background: '#161822', padding: '16px 20px', overflowY: 'auto', flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#fff' }}>{entry.title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20, padding: '0 4px' }}>×</button>
      </div>

      <div style={{ fontSize: 12, color: '#888', marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {entry.subject && <span style={{ background: '#2a2d45', padding: '3px 10px', borderRadius: 12 }}>{entry.subject}</span>}
        <span style={{ background: '#1c1f2e', padding: '3px 10px', borderRadius: 12 }}>{entry.created_date}</span>
        <span style={{ background: '#1c1f2e', padding: '3px 10px', borderRadius: 12 }}>{entry.source_type}</span>
      </div>

      <div style={{ fontSize: 14, lineHeight: 1.8, color: '#ddd', background: '#1c1f2e', padding: '14px 16px', borderRadius: 8, marginBottom: 16 }}>
        {entry.content}
      </div>

      {entry.tags?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>标签</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {entry.tags.map((t, i) => (
              <span key={i} style={{ background: '#2a2d45', padding: '3px 10px', borderRadius: 12, fontSize: 12, color: '#bbb' }}>#{t}</span>
            ))}
          </div>
        </div>
      )}

      {connectedEntries.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>📎 关联知识 ({connectedEntries.length})</div>
          {connectedEntries.map(e => (
            <div key={e.id} onClick={() => onNavigate(e)}
              style={{ padding: '8px 10px', marginBottom: 4, borderRadius: 6, cursor: 'pointer', background: '#1c1f2e',
                borderLeft: '3px solid #4285f4', transition: 'background 0.15s' }}
              onMouseEnter={ev => ev.currentTarget.style.background = '#222640'}
              onMouseLeave={ev => ev.currentTarget.style.background = '#1c1f2e'}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#ccc' }}>{e.title}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{e.subject}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: '1px solid #2a2d35', paddingTop: 12 }}>
        <button onClick={handleDelete}
          style={{ padding: '6px 16px', background: '#d32f2f22', color: '#ef5350', border: '1px solid #d32f2f44', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          删除此条目
        </button>
      </div>
    </div>
  );
}
