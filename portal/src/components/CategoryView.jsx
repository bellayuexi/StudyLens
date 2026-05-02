import React, { useMemo, useState } from 'react';

const DIMENSION_TAGS = [
  '政治制度', '军事战争', '经济发展', '民族关系', '对外交流',
  '科技发明', '文化艺术', '社会生活', '人物', '朝代兴衰', '边疆管辖',
];

const TAG_COLORS = {
  '政治制度': '#e53935', '军事战争': '#ff6d00', '经济发展': '#43a047',
  '民族关系': '#8e24aa', '对外交流': '#00acc1', '科技发明': '#fdd835',
  '文化艺术': '#e91e63', '社会生活': '#5c6bc0', '人物': '#4285f4',
  '朝代兴衰': '#78909c', '边疆管辖': '#6d4c41',
};

function getTagColor(tag) {
  return TAG_COLORS[tag] || '#666';
}

export default function CategoryView({ entries, onEntryClick, selectedId }) {
  const [activeTag, setActiveTag] = useState(null);
  const [groupBy, setGroupBy] = useState('dimension');

  const allTags = useMemo(() => {
    const tagCount = {};
    entries.forEach(e => {
      (e.tags || []).forEach(t => {
        if (DIMENSION_TAGS.includes(t)) tagCount[t] = (tagCount[t] || 0) + 1;
      });
    });
    return DIMENSION_TAGS.filter(t => tagCount[t]).map(t => ({ tag: t, count: tagCount[t] }));
  }, [entries]);

  const grouped = useMemo(() => {
    if (groupBy === 'subject') {
      const g = {};
      const filtered = activeTag ? entries.filter(e => (e.tags || []).includes(activeTag)) : entries;
      filtered.forEach(e => {
        const key = e.subject || '未分类';
        if (!g[key]) g[key] = [];
        g[key].push(e);
      });
      return Object.entries(g).sort((a, b) => b[1].length - a[1].length);
    }
    // Group by dimension tag
    const g = {};
    const tags = activeTag ? [activeTag] : allTags.map(t => t.tag);
    tags.forEach(tag => {
      const items = entries.filter(e => (e.tags || []).includes(tag));
      if (items.length > 0) g[tag] = items;
    });
    return Object.entries(g).sort((a, b) => b[1].length - a[1].length);
  }, [entries, activeTag, groupBy, allTags]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 24px', background: '#0f1117' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Controls bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: '#1c1f2e', borderRadius: 8, padding: 3 }}>
            {[{ id: 'dimension', label: '按维度' }, { id: 'subject', label: '按朝代' }].map(m => (
              <button key={m.id} onClick={() => setGroupBy(m.id)}
                style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                  background: groupBy === m.id ? '#4285f4' : 'transparent', color: groupBy === m.id ? '#fff' : '#aaa' }}>
                {m.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <span onClick={() => setActiveTag(null)}
              style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                background: activeTag === null ? '#4285f4' : '#1c1f2e', color: activeTag === null ? '#fff' : '#aaa' }}>
              全部
            </span>
            {allTags.map(({ tag, count }) => (
              <span key={tag} onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                  background: tag === activeTag ? getTagColor(tag) : '#1c1f2e',
                  color: tag === activeTag ? '#fff' : '#aaa',
                  borderLeft: `3px solid ${getTagColor(tag)}` }}>
                {tag} ({count})
              </span>
            ))}
          </div>
        </div>

        {/* Cards grid */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {grouped.map(([key, items]) => (
            <div key={key} style={{ flex: '1 1 320px', minWidth: 300, maxWidth: 500, background: '#161822', borderRadius: 10,
              borderTop: `3px solid ${getTagColor(key)}`, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: getTagColor(key), display: 'inline-block' }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{key}</span>
                <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>{items.length} 个</span>
              </div>
              <div style={{ maxHeight: 400, overflowY: 'auto', marginTop: 8 }}>
                {items.map(e => (
                  <div key={e.id} onClick={() => onEntryClick(e)}
                    style={{ padding: '8px 10px', marginBottom: 4, borderRadius: 6, cursor: 'pointer',
                      background: selectedId === e.id ? '#2a2d45' : '#1c1f2e', transition: 'background 0.15s' }}
                    onMouseEnter={ev => { if (selectedId !== e.id) ev.currentTarget.style.background = '#222640'; }}
                    onMouseLeave={ev => { if (selectedId !== e.id) ev.currentTarget.style.background = '#1c1f2e'; }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#ddd' }}>{e.title}</div>
                    <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>{e.subject}</div>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4 }}>
                      {(e.tags || []).filter(t => DIMENSION_TAGS.includes(t)).map((t, i) => (
                        <span key={i} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8,
                          background: t === activeTag ? getTagColor(t) : '#1c1f2e',
                          color: t === activeTag ? '#fff' : '#666' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
