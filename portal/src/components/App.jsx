import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TimelineView from './TimelineView.jsx';
import IngestPanel from './IngestPanel.jsx';
import EntryDetail from './EntryDetail.jsx';
import CategoryView from './CategoryView.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import { fetchGraph } from '../lib/api.js';
import { getColor } from '../lib/colors.js';

const VIEWS = [
  { id: 'timeline', label: '📅 时间线' },
  { id: 'category', label: '📂 分类' },
];

export default function App() {
  const navigate = useNavigate();
  const sharedCacheRef = useRef(window.__sg_entry_cache || {});
  const [allEntries, setAllEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const selectedEntryRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [leftWidth, setLeftWidth] = useState(360);
  const [dragging, setDragging] = useState(false);
  const [filterDiscipline, setFilterDiscipline] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('sg_filterDiscipline')); } catch { return null; }
  });
  const [filterSubCategory, setFilterSubCategory] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('sg_filterSubCategory')); } catch { return null; }
  });
  const [viewMode, setViewMode] = useState(() => sessionStorage.getItem('sg_viewMode') || 'category');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const pendingEntryId = useRef(sessionStorage.getItem('sg_selectedEntryId'));

  useEffect(() => {
    window.__sg_entry_cache = sharedCacheRef.current;
  }, []);

  const loadGraph = useCallback(async () => {
    const { entries } = await fetchGraph('wiki');
    setAllEntries(entries);
    if (pendingEntryId.current) {
      const match = entries.find(e => e.id === pendingEntryId.current);
      if (match) { setSelectedEntry(match); selectedEntryRef.current = match.id; }
      pendingEntryId.current = null;
    } else if (selectedEntryRef.current) {
      const match = entries.find(e => e.id === selectedEntryRef.current);
      if (match) setSelectedEntry(match);
    }
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  useEffect(() => {
    sessionStorage.setItem('sg_filterDiscipline', JSON.stringify(filterDiscipline));
  }, [filterDiscipline]);
  useEffect(() => {
    sessionStorage.setItem('sg_filterSubCategory', JSON.stringify(filterSubCategory));
  }, [filterSubCategory]);
  useEffect(() => {
    sessionStorage.setItem('sg_viewMode', viewMode);
  }, [viewMode]);
  useEffect(() => {
    sessionStorage.setItem('sg_selectedEntryId', selectedEntry?.id || '');
  }, [selectedEntry]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => setLeftWidth(Math.max(280, Math.min(500, e.clientX)));
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const subjects = [...new Set(allEntries.map(e => e.subject).filter(Boolean))];
  const disciplines = [...new Set(subjects.map(s => s.split('-')[0]))];
  const subCategories = filterDiscipline
    ? [...new Set(subjects.filter(s => s.startsWith(filterDiscipline + '-')).map(s => s.split('-').slice(1).join('-')))]
    : [];
  const handleEntryClick = (entry) => { setSelectedEntry(entry); selectedEntryRef.current = entry?.id || null; };

  const filteredEntries = allEntries.filter(e => {
    if (filterDiscipline) {
      if (!e.subject || !e.subject.startsWith(filterDiscipline)) return false;
      if (filterSubCategory && e.subject !== filterDiscipline + '-' + filterSubCategory) return false;
    }
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
            <h1 style={{ margin: 0, fontSize: 18, color: '#fff' }}>📚 StudyLens</h1>
            <button data-testid="settings-btn" onClick={() => setShowSettings(!showSettings)}
              style={{ padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 14,
                background: showSettings ? '#4285f4' : '#1c1f2e', color: showSettings ? '#fff' : '#888' }}>
              ⚙️
            </button>
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

        {/* Discipline selector */}
        {disciplines.length > 0 && (
          <div style={{ padding: '6px 12px', borderBottom: '1px solid #2a2d35', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <span onClick={() => { setFilterDiscipline(null); setFilterSubCategory(null); }}
              style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, cursor: 'pointer', fontWeight: 500,
                background: filterDiscipline === null ? '#4285f4' : '#1c1f2e', color: filterDiscipline === null ? '#fff' : '#aaa' }}>全部</span>
            {disciplines.map(d => (
              <span key={d} onClick={() => { setFilterDiscipline(d === filterDiscipline ? null : d); setFilterSubCategory(null); }}
                style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, cursor: 'pointer', fontWeight: 500,
                  background: d === filterDiscipline ? getColor(d) : '#1c1f2e',
                  color: d === filterDiscipline ? '#fff' : '#aaa' }}>
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Sub-category filter */}
        {viewMode === 'category' && filterDiscipline && subCategories.length > 0 && (
          <div style={{ padding: '4px 12px', borderBottom: '1px solid #2a2d35', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <span onClick={() => setFilterSubCategory(null)}
              style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, cursor: 'pointer',
                background: filterSubCategory === null ? '#4285f433' : '#1c1f2e', color: filterSubCategory === null ? '#ddd' : '#777' }}>全部{filterDiscipline}</span>
            {subCategories.map(s => (
              <span key={s} onClick={() => setFilterSubCategory(s === filterSubCategory ? null : s)}
                style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, cursor: 'pointer',
                  background: s === filterSubCategory ? getColor(filterDiscipline + '-' + s) : '#1c1f2e',
                  color: s === filterSubCategory ? '#fff' : '#aaa',
                  borderLeft: `2px solid ${getColor(filterDiscipline + '-' + s)}` }}>
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
                    <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      {e.has_topic_page && (
                        <span style={{ fontSize: 9, color: '#4caf50', padding: '0 4px', borderRadius: 3, background: '#4caf5018', lineHeight: '16px' }}>专题</span>
                      )}
                      {e.has_qa && (
                        <span style={{ fontSize: 9, color: '#ff9800', padding: '0 4px', borderRadius: 3, background: '#ff980018', lineHeight: '16px' }}>问答</span>
                      )}
                      {e.has_children && (
                        <span onClick={(ev) => { ev.stopPropagation(); navigate(`/deep/${e.id}`); }}
                          style={{ fontSize: 9, color: '#4285f4', cursor: 'pointer', padding: '0 4px', borderRadius: 3, background: '#4285f418', lineHeight: '16px' }}>
                          深入
                        </span>
                      )}
                    </span>
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
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {showSettings && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
            <SettingsPanel onClose={() => setShowSettings(false)} />
          </div>
        )}
        {selectedEntry ? (
          <EntryDetail
            entry={selectedEntry}
            allEntries={allEntries}
            onClose={() => { setSelectedEntry(null); selectedEntryRef.current = null; }}
            onDeleted={() => { setSelectedEntry(null); selectedEntryRef.current = null; loadGraph(); }}
            onNavigate={(entry) => { setSelectedEntry(entry); selectedEntryRef.current = entry?.id || null; }}
            onUpdated={loadGraph}
            sharedCacheRef={sharedCacheRef}
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
