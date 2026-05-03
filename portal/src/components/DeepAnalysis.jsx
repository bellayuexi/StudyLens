import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EntryDetail from './EntryDetail.jsx';
import { getChildren, expandEntry, addChildEntry, deleteEntry, updateEntry, getLatestTopicPage, generateTopicPage, saveTopicPage } from '../lib/api.js';

const CATEGORY_COLORS = {
  '背景': '#4285f4', '内容': '#34a853', '影响': '#fbbc05',
  '对比': '#9c27b0', '评价': '#ea4335', '其他': '#666',
};

function getCatColor(tags) {
  for (const [cat, color] of Object.entries(CATEGORY_COLORS)) {
    if (tags?.some(t => t.includes(cat))) return color;
  }
  return '#666';
}

export default function DeepAnalysis() {
  const { entryId } = useParams();
  const navigate = useNavigate();
  const [parentEntry, setParentEntry] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [expanding, setExpanding] = useState(false);
  const [leftWidth, setLeftWidth] = useState(340);
  const [dragging, setDragging] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [parentTopicHTML, setParentTopicHTML] = useState('');
  const [parentTopicVersion, setParentTopicVersion] = useState(0);
  const [updatingSummary, setUpdatingSummary] = useState(false);

  const loadData = useCallback(async () => {
    const res = await fetch(`/api/entries/${entryId}`);
    if (res.ok) {
      const entry = await res.json();
      setParentEntry(entry);
    }
    const childRes = await getChildren(entryId);
    setChildren(childRes.children || []);
    try {
      const topicData = await getLatestTopicPage(entryId);
      if (topicData.page) {
        setParentTopicHTML(topicData.page.html);
        setParentTopicVersion(topicData.page.version);
      }
    } catch {}
  }, [entryId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => setLeftWidth(Math.max(260, Math.min(480, e.clientX)));
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const handleExpand = async () => {
    setExpanding(true);
    try {
      const data = await expandEntry(entryId);
      setChildren(prev => [...prev, ...(data.children || [])]);
    } catch (e) { console.error(e); }
    setExpanding(false);
  };

  const handleAddChild = async () => {
    if (!newTitle.trim()) return;
    const child = await addChildEntry(entryId, { title: newTitle, content: newContent });
    setChildren(prev => [...prev, child]);
    setNewTitle('');
    setNewContent('');
    setAddMode(false);
  };

  const handleUpdateSummary = async () => {
    setUpdatingSummary(true);
    try {
      const childQa = children.map(c => ({
        question: c.title,
        answer: c.content,
        category: c.tags?.find(t => Object.keys(CATEGORY_COLORS).some(k => t.includes(k))) || '子主题',
      }));
      const data = await generateTopicPage(entryId, childQa, parentTopicHTML);
      const rawHtml = data.html || '';
      if (rawHtml.replace(/<[^>]*>/g, '').trim().length < 50) {
        setUpdatingSummary(false);
        return;
      }
      const ts = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      const badge = `<div style="text-align:right;padding:8px 16px;font-size:11px;color:#666;border-bottom:1px solid #333;">综述更新: ${ts}</div>`;
      const html = rawHtml.replace(/<body[^>]*>/, (m) => m + badge) || badge + rawHtml;
      setParentTopicHTML(html);
      const saved = await saveTopicPage(entryId, html, childQa);
      setParentTopicVersion(saved.version);
    } catch (e) { console.error(e); }
    setUpdatingSummary(false);
  };

  const categories = {};
  children.forEach(c => {
    const cat = c.tags?.find(t => Object.keys(CATEGORY_COLORS).some(k => t.includes(k))) || '其他';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(c);
  });

  const inputStyle = { padding: '6px 10px', borderRadius: 6, border: '1px solid #2a2d45', background: '#1c1f2e', color: '#ddd', fontSize: 12, outline: 'none', fontFamily: 'inherit' };

  if (!parentEntry) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117', color: '#888' }}>加载中...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0f1117', color: '#e0e0e0', overflow: 'hidden' }}>
      {/* Left sidebar */}
      <div style={{ width: leftWidth, minWidth: 260, borderRight: '1px solid #2a2d35', display: 'flex', flexDirection: 'column', background: '#161822', flexShrink: 0 }}>
        {/* Header with breadcrumb */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2d35' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span onClick={() => navigate('/')} style={{ cursor: 'pointer', color: '#4285f4', fontSize: 12 }}>
              ← 返回主页
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: 16, color: '#fff' }}>🔬 {parentEntry.title}</h2>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>深入分析 · {children.length} 个子节点</div>
        </div>

        {/* Parent entry - click to show overview */}
        <div onClick={() => setSelectedChild(null)}
          style={{ padding: '10px 16px', borderBottom: '1px solid #2a2d35', cursor: 'pointer',
            background: selectedChild === null ? '#2a2d45' : '#161822', transition: 'background 0.15s' }}
          onMouseEnter={ev => { if (selectedChild !== null) ev.currentTarget.style.background = '#222640'; }}
          onMouseLeave={ev => { if (selectedChild !== null) ev.currentTarget.style.background = '#161822'; }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: selectedChild === null ? '#4285f4' : '#aaa' }}>
            📄 综述: {parentEntry.title}
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
            {parentTopicVersion > 0 ? `v${parentTopicVersion} · 点击查看综述` : '点击查看综述'}
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a2d35', display: 'flex', gap: 6 }}>
          <button onClick={handleExpand} disabled={expanding}
            style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', background: '#4285f422', color: '#4285f4', cursor: expanding ? 'wait' : 'pointer', fontSize: 12 }}>
            {expanding ? 'AI拆解中...' : '🤖 AI自动拆解'}
          </button>
          <button onClick={() => setAddMode(!addMode)}
            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#34a85322', color: '#34a853', cursor: 'pointer', fontSize: 12 }}>
            + 手动添加
          </button>
        </div>

        {/* Add child form */}
        {addMode && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a2d35', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="子知识点标题"
              style={{ ...inputStyle }} />
            <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="内容描述"
              rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={handleAddChild} disabled={!newTitle.trim()}
                style={{ flex: 1, padding: '5px', borderRadius: 4, border: 'none', background: '#34a853', color: '#fff', cursor: 'pointer', fontSize: 11 }}>添加</button>
              <button onClick={() => setAddMode(false)}
                style={{ padding: '5px 10px', borderRadius: 4, border: 'none', background: '#333', color: '#aaa', cursor: 'pointer', fontSize: 11 }}>取消</button>
            </div>
          </div>
        )}

        {/* Children list grouped by category */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
          {children.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#555', fontSize: 13 }}>
              暂无子节点，点击「AI自动拆解」或「手动添加」开始
            </div>
          ) : (
            Object.entries(categories).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#888', padding: '4px 0', borderBottom: `1px solid ${getCatColor(items[0]?.tags)}33` }}>
                  {cat} ({items.length})
                </div>
                {items.map(c => (
                  <div key={c.id} onClick={() => setSelectedChild(c)}
                    style={{ padding: '8px 10px', marginTop: 4, borderRadius: 6, cursor: 'pointer',
                      background: selectedChild?.id === c.id ? '#2a2d45' : '#1c1f2e',
                      borderLeft: `3px solid ${getCatColor(c.tags)}`, transition: 'background 0.15s' }}
                    onMouseEnter={ev => { if (selectedChild?.id !== c.id) ev.currentTarget.style.background = '#222640'; }}
                    onMouseLeave={ev => { if (selectedChild?.id !== c.id) ev.currentTarget.style.background = '#1c1f2e'; }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.title}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.content}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Resize handle */}
      <div onMouseDown={() => setDragging(true)}
        style={{ width: 4, cursor: 'col-resize', background: dragging ? '#4285f4' : 'transparent', flexShrink: 0 }}
        onMouseEnter={ev => ev.currentTarget.style.background = '#4285f4'}
        onMouseLeave={ev => { if (!dragging) ev.currentTarget.style.background = 'transparent'; }} />

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {selectedChild ? (
          <EntryDetail
            entry={selectedChild}
            allEntries={children}
            onClose={() => setSelectedChild(null)}
            onDeleted={() => { setSelectedChild(null); loadData(); }}
            onNavigate={(entry) => setSelectedChild(entry)}
            onUpdated={loadData}
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Summary toolbar */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #2a2d35', background: '#161822', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                📄 {parentEntry.title} — 综述
                {parentTopicVersion > 0 && <span style={{ fontSize: 11, color: '#34a853', marginLeft: 6 }}>v{parentTopicVersion}</span>}
              </div>
              {children.length > 0 && (
                <button onClick={handleUpdateSummary} disabled={updatingSummary}
                  style={{ padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12,
                    background: updatingSummary ? '#333' : '#9c27b033', color: updatingSummary ? '#666' : '#ce93d8',
                    cursor: updatingSummary ? 'wait' : 'pointer' }}>
                  {updatingSummary ? '更新中...' : '🔄 用子节点内容更新综述'}
                </button>
              )}
            </div>
            {parentTopicHTML ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <iframe srcDoc={parentTopicHTML} style={{ flex: 1, border: 'none', background: '#0f1117' }} title="综述页面" />
                {children.length > 0 && (
                  <div style={{ padding: '8px 16px', borderTop: '1px solid #2a2d35', background: '#161822' }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>子主题导航</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {children.map(c => (
                        <span key={c.id} onClick={() => setSelectedChild(c)}
                          style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                            background: '#1c1f2e', color: '#aaa', borderLeft: `2px solid ${getCatColor(c.tags)}` }}>
                          {c.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: '#444' }}>
                  <div style={{ fontSize: 64, marginBottom: 16 }}>🔬</div>
                  <div style={{ fontSize: 18, color: '#666' }}>{parentEntry.title} - 深入分析</div>
                  <div style={{ fontSize: 13, color: '#444', marginTop: 8 }}>
                    {children.length > 0 ? '选择左侧子知识点开始探索，或点击「更新综述」生成综合页面' : '点击「AI自动拆解」生成子知识点'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
