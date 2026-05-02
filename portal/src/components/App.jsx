import React, { useState, useEffect, useCallback } from 'react';
import KnowledgeGraph from './KnowledgeGraph.jsx';
import TimelineView from './TimelineView.jsx';
import IngestPanel from './IngestPanel.jsx';
import EntryDetail from './EntryDetail.jsx';
import CategoryView from './CategoryView.jsx';
import QAPanel from './QAPanel.jsx';
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
  { id: 'graph', label: '🔗 知识图谱', desc: '关联网络' },
  { id: 'timeline', label: '📅 时间线', desc: '按历史年代排列' },
  { id: 'category', label: '📂 分类', desc: '按学科归类' },
];

export default function App() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [allEntries, setAllEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [leftWidth, setLeftWidth] = useState(420);
  const [dragging, setDragging] = useState(false);
  const [filterSubject, setFilterSubject] = useState(null);
  const [viewMode, setViewMode] = useState('graph');
  const [backend, setBackend] = useState('wiki');

  const loadGraph = useCallback(async () => {
    const { entries, connections } = await fetchGraph(backend);
    setAllEntries(entries);
    const nodes = entries.map(e => ({
      id: e.id,
      name: e.title,
      subject: e.subject,
      val: 4 + connections.filter(c => c.from_id === e.id || c.to_id === e.id).length * 2,
      color: e.source_type === 'qa' ? '#ce93d8' : getColor(e.subject),
      isQA: e.source_type === 'qa',
      _entry: e,
    }));
    const nodeIds = new Set(nodes.map(n => n.id));
    const links = connections
      .filter(c => nodeIds.has(c.from_id) && nodeIds.has(c.to_id))
      .map(c => ({ source: c.from_id, target: c.to_id, label: c.relation }));
    setGraphData({ nodes, links });
  }, [backend]);

  useEffect(() => { loadGraph(); }, [loadGraph]);
  useEffect(() => { loadGraph(); }, [backend]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => setLeftWidth(Math.max(300, Math.min(700, e.clientX)));
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const subjects = [...new Set(allEntries.map(e => e.subject).filter(Boolean))];

  const handleNodeClick = (node) => setSelectedEntry(node._entry);
  const handleEntryClick = (entry) => setSelectedEntry(entry);

  const getConnectedEntries = (entry) => {
    if (!entry) return [];
    const connIds = new Set();
    graphData.links.forEach(l => {
      const src = typeof l.source === 'object' ? l.source.id : l.source;
      const tgt = typeof l.target === 'object' ? l.target.id : l.target;
      if (src === entry.id) connIds.add(tgt);
      if (tgt === entry.id) connIds.add(src);
    });
    return allEntries.filter(e => connIds.has(e.id));
  };

  // Category view replaced by CategoryView component

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0f1117', color: '#e0e0e0', overflow: 'hidden' }}>
      {/* Left Panel */}
      <div style={{ width: leftWidth, minWidth: 300, borderRight: '1px solid #2a2d35', display: 'flex', flexDirection: 'column', background: '#161822', flexShrink: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a2d35' }}>
          <h1 style={{ margin: 0, fontSize: 22, color: '#fff' }}>📚 StudyGraph</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>个人知识图谱学习系统</p>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            {['wiki', 'sqlite'].map(b => (
              <button key={b} onClick={() => setBackend(b)}
                style={{ flex: 1, padding: '4px 0', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11,
                  background: backend === b ? (b === 'wiki' ? '#34a853' : '#4285f4') : '#1c1f2e',
                  color: backend === b ? '#fff' : '#777' }}>
                {b === 'wiki' ? 'LM Wiki' : 'SQLite'}
              </button>
            ))}
          </div>
        </div>

        <IngestPanel onIngested={loadGraph} loading={loading} setLoading={setLoading} />

        <QAPanel onSaved={loadGraph} />

        {/* View switcher */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #2a2d35', display: 'flex', gap: 4 }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)}
              style={{ flex: 1, padding: '6px 4px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                background: viewMode === v.id ? '#4285f4' : '#1c1f2e', color: viewMode === v.id ? '#fff' : '#aaa',
                transition: 'background 0.15s' }}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Subject filter */}
        {subjects.length > 0 && (
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #2a2d35', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <span onClick={() => setFilterSubject(null)}
              style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                background: filterSubject === null ? '#4285f4' : '#1c1f2e', color: filterSubject === null ? '#fff' : '#aaa' }}>全部</span>
            {subjects.map(s => (
              <span key={s} onClick={() => setFilterSubject(s === filterSubject ? null : s)}
                style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                  background: s === filterSubject ? getColor(s) : '#1c1f2e',
                  color: s === filterSubject ? '#fff' : '#aaa',
                  borderLeft: `3px solid ${getColor(s)}` }}>
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Entry list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
            知识条目 ({filterSubject ? allEntries.filter(e => e.subject === filterSubject).length : allEntries.length})
          </div>
          {allEntries
            .filter(e => !filterSubject || e.subject === filterSubject)
            .map(e => (
            <div key={e.id} onClick={() => handleEntryClick(e)}
              style={{ padding: '10px 12px', marginBottom: 5, borderRadius: 8, cursor: 'pointer',
                background: selectedEntry?.id === e.id ? '#2a2d45' : '#1c1f2e',
                borderLeft: `3px solid ${getColor(e.subject)}`,
                transition: 'background 0.15s' }}
              onMouseEnter={ev => { if (selectedEntry?.id !== e.id) ev.currentTarget.style.background = '#222640'; }}
              onMouseLeave={ev => { if (selectedEntry?.id !== e.id) ev.currentTarget.style.background = '#1c1f2e'; }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{e.title}</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 3, lineHeight: 1.4,
                overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {e.content}
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                {e.source_type === 'qa' && <span style={{ background: '#9c27b044', color: '#ce93d8', padding: '1px 6px', borderRadius: 4, fontSize: 10, marginRight: 4 }}>问答</span>}
                {e.subject} · {e.created_date}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resize handle */}
      <div onMouseDown={() => setDragging(true)}
        style={{ width: 4, cursor: 'col-resize', background: dragging ? '#4285f4' : 'transparent', flexShrink: 0 }}
        onMouseEnter={ev => ev.currentTarget.style.background = '#4285f4'}
        onMouseLeave={ev => { if (!dragging) ev.currentTarget.style.background = 'transparent'; }} />

      {/* Center: Main View */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && (
          <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: '#4285f4', color: '#fff', padding: '8px 20px', borderRadius: 20, zIndex: 10, fontSize: 13 }}>
            AI 正在分析知识点...
          </div>
        )}

        {viewMode === 'graph' && (
          <>
            {/* Legend — bottom right to avoid overlapping nodes */}
            {subjects.length > 0 && (
              <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 10, background: 'rgba(22,24,34,0.9)',
                padding: '10px 14px', borderRadius: 8, fontSize: 12 }}>
                <div style={{ color: '#888', marginBottom: 6, fontSize: 11 }}>图例</div>
                {subjects.map(s => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: getColor(s), marginRight: 6 }} />
                    <span style={{ color: '#ccc' }}>{s}</span>
                  </div>
                ))}
                <div style={{ color: '#666', marginTop: 6, fontSize: 10, lineHeight: 1.4 }}>
                  点击节点查看详情 · 滚轮缩放 · 拖拽平移
                </div>
              </div>
            )}
            <KnowledgeGraph data={graphData} onNodeClick={handleNodeClick} selectedId={selectedEntry?.id} />
          </>
        )}

        {viewMode === 'timeline' && (
          <TimelineView entries={allEntries} onEntryClick={handleEntryClick} selectedId={selectedEntry?.id} />
        )}

        {viewMode === 'category' && (
          <CategoryView entries={allEntries} onEntryClick={handleEntryClick} selectedId={selectedEntry?.id} />
        )}
      </div>

      {/* Right: Detail */}
      {selectedEntry && (
        <EntryDetail
          entry={selectedEntry}
          connectedEntries={getConnectedEntries(selectedEntry)}
          onClose={() => setSelectedEntry(null)}
          onDeleted={() => { setSelectedEntry(null); loadGraph(); }}
          onNavigate={(entry) => setSelectedEntry(entry)}
          onUpdated={loadGraph}
        />
      )}
    </div>
  );
}
