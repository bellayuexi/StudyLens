import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TimelineView from './TimelineView.jsx';
import IngestPanel from './IngestPanel.jsx';
import EntryDetail from './EntryDetail.jsx';
import CategoryView from './CategoryView.jsx';
import { fetchGraph } from '../lib/api.js';

const SUBJECT_COLORS = {};
const PALETTE = ['#4285f4', '#ea4335', '#34a853', '#fbbc05', '#9c27b0', '#ff6d00', '#00bcd4', '#e91e63'];
let colorIdx = 0;
function getColor(subject) {
  if (!subject) return '#999';
  if (!SUBJECT_COLORS[subject]) SUBJECT_COLORS[subject] = PALETTE[colorIdx++ % PALETTE.length];
  return SUBJECT_COLORS[subject];
}

const VIEWS = [
  { id: 'timeline', label: '📅 时间线' },
  { id: 'category', label: '📂 分类' },
];

export default function App() {
  const navigate = useNavigate();
  const [allEntries, setAllEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [leftWidth, setLeftWidth] = useState(360);
  const [dragging, setDragging] = useState(false);
  const [filterSubject, setFilterSubject] = useState(null);
  const [viewMode, setViewMode] = useState('category');
  const [backend, setBackend] = useState('wiki');
  const [searchQuery, setSearchQuery] = useState('');

  const loadGraph = useCallback(async () => {
    const { entries } = await fetchGraph(backend);
    setAllEntries(entries);
  }, [backend]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => setLeftWidth(Math.max(280, Math.min(500, e.clientX)));
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const subjects = [...new Set(allEntries.map(e => e.subject).filter(Boolean))];
  const handleEntryClick = (entry) => setSelectedEntry(entry);

  const filteredEntries = allEntries.filter(e => {
    if (filterSubject && e.subject !== filterSubject) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (e.title + e.content + (e.tags || []).join(' ') + e.subject).toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0f1117', color: '#e0e0e0', overflow: 'hidden' }}>
      {/* Left Sidebar */}
      <div style={{ width: leftWidth, minWidth: 280, borderRight: '1px solid #2a2d35', display: 'flex', flexDirection: 'column', background: '#161822', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2d35' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ margin: 0, fontSize: 18, color: '#fff' }}>📚 StudyGraph</h1>
            <div style={{ display: 'flex', gap: 2 }}>
              {['wiki', 'sqlite'].map(b => (
                <button key={b} onClick={() => setBackend(b)}
                  style={{ padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 10,
                    background: backend === b ? (b === 'wiki' ? '#34a853' : '#4285f4') : '#1c1f2e',
                    color: backend === b ? '#fff' : '#777' }}>
                  {b === 'wiki' ? 'Wiki' : 'DB'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <IngestPanel onIngested={loadGraph} loading={loading} setLoading={setLoading} />

        {/* View switcher + Search */}
        <div style={{ padding: '6px 12px', borderBottom: '1px solid #2a2d35', display: 'flex', gap: 4, alignItems: 'center' }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)}
              style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                background: viewMode === v.id ? '#4285f4' : '#1c1f2e', color: viewMode === v.id ? '#fff' : '#aaa' }}>
              {v.label}
            </button>
          ))}
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍 搜索..."
            style={{ flex: 1, padding: '5px 10px', borderRadius: 6, border: '1px solid #2a2d45',
              background: '#1c1f2e', color: '#ddd', fontSize: 12, outline: 'none', fontFamily: 'inherit', minWidth: 0 }} />
        </div>

        {/* Subject filter */}
        {viewMode === 'category' && subjects.length > 0 && (
          <div style={{ padding: '6px 12px', borderBottom: '1px solid #2a2d35', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <span onClick={() => setFilterSubject(null)}
              style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, cursor: 'pointer',
                background: filterSubject === null ? '#4285f4' : '#1c1f2e', color: filterSubject === null ? '#fff' : '#aaa' }}>全部</span>
            {subjects.map(s => (
              <span key={s} onClick={() => setFilterSubject(s === filterSubject ? null : s)}
                style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, cursor: 'pointer',
                  background: s === filterSubject ? getColor(s) : '#1c1f2e',
                  color: s === filterSubject ? '#fff' : '#aaa',
                  borderLeft: `2px solid ${getColor(s)}` }}>
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Entry list — inline timeline or category */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {viewMode === 'category' ? (
            <div style={{ padding: '6px 10px' }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>
                {filteredEntries.length} 个知识点
              </div>
              {filteredEntries.map(e => (
                <div key={e.id} onClick={() => handleEntryClick(e)}
                  style={{ padding: '8px 10px', marginBottom: 4, borderRadius: 6, cursor: 'pointer',
                    background: selectedEntry?.id === e.id ? '#2a2d45' : '#1c1f2e',
                    borderLeft: `3px solid ${getColor(e.subject)}`, transition: 'background 0.15s' }}
                  onMouseEnter={ev => { if (selectedEntry?.id !== e.id) ev.currentTarget.style.background = '#222640'; }}
                  onMouseLeave={ev => { if (selectedEntry?.id !== e.id) ev.currentTarget.style.background = '#1c1f2e'; }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.content}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: '#555' }}>{e.subject}</span>
                    {e.has_children && (
                      <span onClick={(ev) => { ev.stopPropagation(); navigate(`/deep/${e.id}`); }}
                        style={{ fontSize: 10, color: '#4285f4', cursor: 'pointer', padding: '1px 6px', borderRadius: 4, background: '#4285f411' }}>
                        🔬 深入
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TimelineView entries={filteredEntries} onEntryClick={handleEntryClick} selectedId={selectedEntry?.id} compact />
          )}
        </div>
      </div>

      {/* Resize handle */}
      <div onMouseDown={() => setDragging(true)}
        style={{ width: 4, cursor: 'col-resize', background: dragging ? '#4285f4' : 'transparent', flexShrink: 0 }}
        onMouseEnter={ev => ev.currentTarget.style.background = '#4285f4'}
        onMouseLeave={ev => { if (!dragging) ev.currentTarget.style.background = 'transparent'; }} />

      {/* Main Content: Knowledge Exploration */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {selectedEntry ? (
          <EntryDetail
            entry={selectedEntry}
            allEntries={allEntries}
            onClose={() => setSelectedEntry(null)}
            onDeleted={() => { setSelectedEntry(null); loadGraph(); }}
            onNavigate={(entry) => setSelectedEntry(entry)}
            onUpdated={loadGraph}
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#444' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>📚</div>
              <div style={{ fontSize: 18, color: '#666' }}>选择一个知识点开始探索</div>
              <div style={{ fontSize: 13, color: '#444', marginTop: 8 }}>点击左侧列表中的知识点，深入学习</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
