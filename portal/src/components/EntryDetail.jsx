import React, { useState } from 'react';
import { deleteEntry, updateEntry } from '../lib/api.js';

export default function EntryDetail({ entry, connectedEntries = [], onClose, onDeleted, onNavigate, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

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

  const handleDelete = async () => {
    await deleteEntry(entry.id);
    onDeleted();
  };

  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #2a2d45', background: '#1c1f2e', color: '#ddd', fontSize: 13, boxSizing: 'border-box' };

  return (
    <div style={{ width: 360, borderLeft: '1px solid #2a2d35', background: '#161822', padding: '16px 20px', overflowY: 'auto', flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        {editing
          ? <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ ...inputStyle, fontSize: 16, fontWeight: 600 }} />
          : <h3 style={{ margin: 0, fontSize: 18, color: '#fff' }}>{entry.title}</h3>
        }
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20, padding: '0 4px' }}>×</button>
      </div>

      <div style={{ fontSize: 12, color: '#888', marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {editing
          ? <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="学科分类" style={{ ...inputStyle, fontSize: 12 }} />
          : <>
              {entry.subject && <span style={{ background: '#2a2d45', padding: '3px 10px', borderRadius: 12 }}>{entry.subject}</span>}
              <span style={{ background: '#1c1f2e', padding: '3px 10px', borderRadius: 12 }}>{entry.created_date}</span>
            </>
        }
      </div>

      {editing
        ? <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={6}
            style={{ ...inputStyle, lineHeight: 1.8, resize: 'vertical', marginBottom: 16 }} />
        : <div style={{ fontSize: 14, lineHeight: 1.8, color: '#ddd', background: '#1c1f2e', padding: '14px 16px', borderRadius: 8, marginBottom: 16 }}>
            {entry.content}
          </div>
      }

      {/* Tags */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>标签</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(editing ? form.tags : entry.tags || []).map((t, i) => (
            <span key={i} style={{ background: '#2a2d45', padding: '3px 10px', borderRadius: 12, fontSize: 12, color: '#bbb', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              #{t}
              {editing && <span onClick={() => removeTag(t)} style={{ cursor: 'pointer', color: '#ef5350', fontWeight: 700 }}>×</span>}
            </span>
          ))}
        </div>
        {editing && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <input value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="添加标签..." style={{ ...inputStyle, flex: 1 }} />
            <button onClick={addTag} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#4285f4', color: '#fff', cursor: 'pointer', fontSize: 12 }}>+</button>
          </div>
        )}
      </div>

      {connectedEntries.length > 0 && !editing && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>关联知识 ({connectedEntries.length})</div>
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

      <div style={{ borderTop: '1px solid #2a2d35', paddingTop: 12, display: 'flex', gap: 8 }}>
        {editing ? (
          <>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '6px 16px', background: '#4285f4', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              {saving ? '保存中...' : '保存'}
            </button>
            <button onClick={() => setEditing(false)}
              style={{ padding: '6px 16px', background: '#1c1f2e', color: '#aaa', border: '1px solid #2a2d45', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              取消
            </button>
          </>
        ) : (
          <>
            <button onClick={startEdit}
              style={{ padding: '6px 16px', background: '#4285f422', color: '#4285f4', border: '1px solid #4285f444', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              编辑
            </button>
            <button onClick={handleDelete}
              style={{ padding: '6px 16px', background: '#d32f2f22', color: '#ef5350', border: '1px solid #d32f2f44', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              删除
            </button>
          </>
        )}
      </div>
    </div>
  );
}
