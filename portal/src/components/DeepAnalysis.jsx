import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EntryDetail from './EntryDetail.jsx';
import { getChildren, expandEntry, addChildEntry, deleteEntry, updateEntry, getLatestTopicPage } from '../lib/api.js';

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
  const childCacheRef = useRef({});
  const [expanding, setExpanding] = useState(false);
  const [leftWidth, setLeftWidth] = useState(340);
  const [dragging, setDragging] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [parentTopicHTML, setParentTopicHTML] = useState('');
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [parentTopicVersion, setParentTopicVersion] = useState(0);


  const loadData = useCallback(async () => {
    const res = await fetch(`/api/entries/${entryId}`);
    if (res.ok) {
      const entry = await res.json();
      setParentEntry(entry);
    }
    const childRes = await getChildren(entryId);
    setChildren((childRes.children || []).sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)));
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


  const handleExport = async () => {
    const pages = [];
    // Fetch all child topic pages
    for (const child of children) {
      try {
        const res = await getLatestTopicPage(child.id);
        if (res?.page?.html) pages.push({ title: child.title, html: res.page.html });
        else pages.push({ title: child.title, html: `<div style="padding:24px;color:#888">暂无专题页</div>` });
      } catch { pages.push({ title: child.title, html: `<div style="padding:24px;color:#888">加载失败</div>` }); }
    }
    const summaryHtml = parentTopicHTML || '<div style="padding:24px;color:#888">暂无综述</div>';
    const stripHtmlWrapper = (html) => {
      const styles = [];
      html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (m, css) => {
        const scoped = css.replace(/\bbody\b/g, '.page-body');
        styles.push(`<style>${scoped}</style>`);
        return '';
      });
      return html
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<html[^>]*>/gi, '')
        .replace(/<\/html>/gi, '')
        .replace(/<head>[\s\S]*?<\/head>/gi, styles.join('\n'))
        .replace(/<body[^>]*>/gi, '<div class="page-body">')
        .replace(/<\/body>/gi, '</div>');
    };
    const widthCSS = '<style>*{max-width:100%!important;box-sizing:border-box!important}body{width:100%!important;margin:0!important;padding:20px 24px!important}</style>';
    const injectCSS = (html) => {
      if (html.includes('</head>')) return html.replace('</head>', widthCSS + '</head>');
      if (html.includes('</body>')) return html.replace('</body>', widthCSS + '</body>');
      return html + widthCSS;
    };
    const summaryStripped = stripHtmlWrapper(summaryHtml);
    const title = parentEntry?.title || '深入分析';
    const childNavItems = pages.map((p, i) => `<a href="#" onclick="showPage('child-${i}');return false" class="nav-item child" id="nav-child-${i}"><span class="dot"></span>${p.title}</a>`).join('\n');
    const exportHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${title} - 深入分析</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0f1117; color: #e0e0e0; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; display: flex; height: 100vh; overflow: hidden; }
.sidebar { width: 280px; min-width: 280px; background: linear-gradient(180deg, #161822 0%, #12141e 100%); border-right: 1px solid #2a2d3a; display: flex; flex-direction: column; }
.sidebar-header { padding: 24px 20px 16px; border-bottom: 1px solid #2a2d3a; }
.sidebar-header h2 { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 4px; }
.sidebar-header .subtitle { font-size: 11px; color: #666; }
.sidebar-nav { flex: 1; overflow-y: auto; padding: 12px 10px; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; margin-bottom: 2px; border-radius: 8px; color: #999; text-decoration: none; font-size: 13px; transition: all 0.15s; cursor: pointer; }
.nav-item:hover { background: #1e2235; color: #ccc; }
.nav-item.active { background: #1e2640; color: #64b5f6; font-weight: 600; }
.nav-item.summary { font-size: 14px; font-weight: 600; padding: 12px 14px; margin-bottom: 8px; border-bottom: 1px solid #2a2d3a; border-radius: 8px 8px 0 0; }
.nav-item.summary .icon { font-size: 16px; }
.nav-item.child { padding-left: 28px; font-size: 12.5px; }
.nav-item.child .dot { width: 6px; height: 6px; border-radius: 50%; background: #444; flex-shrink: 0; transition: background 0.15s; }
.nav-item.child.active .dot { background: #64b5f6; }
.nav-item.child:hover .dot { background: #888; }
.nav-count { font-size: 10px; color: #555; padding: 4px 16px 8px; }
.main-content { flex: 1; overflow: hidden; background: #0f1117; }
.main-content iframe { width: 100%; height: 100%; border: none; background: #0f1117; }
.print-content { display: none; }
.print-content .page-body { max-width: 100% !important; width: 100% !important; padding: 0 !important; margin: 0 !important; }
@media print {
  *, *::before, *::after { background: transparent !important; background-image: none !important; color: #000 !important; text-shadow: none !important; box-shadow: none !important; border-color: #ccc !important; }
  body { display: block !important; padding: 20px !important; }
  .sidebar { display: none !important; }
  .main-content { display: none !important; }
  .print-content { display: block !important; max-width: 100% !important; width: 100% !important; }
  .print-content .print-section { page-break-before: always; padding: 20px 0; }
  .print-content .print-section:first-child { page-break-before: avoid; }
  .print-content h2 { border-bottom: 2px solid #333 !important; padding-bottom: 8px; margin-bottom: 16px; }
  .print-content * { color: #000 !important; max-width: 100% !important; overflow: visible !important; height: auto !important; max-height: none !important; width: auto !important; }
  .print-content .print-section, .print-content .page-body { width: 100% !important; }
  .print-content .page-body { padding: 0 !important; }
  pre, code { background: #f5f5f5 !important; color: #333 !important; }
  h1,h2,h3,h4,h5,h6 { page-break-after: avoid; }
  pre, blockquote, table { page-break-inside: avoid; border: 1px solid #ccc !important; }
  img { max-width: 100% !important; }
  a { color: #000 !important; text-decoration: underline; }
}
</style>
</head>
<body>
<div class="sidebar">
<div class="sidebar-header">
<h2>${title}</h2>
<div class="subtitle">深入分析 · ${pages.length} 个子专题</div>
</div>
<div class="sidebar-nav">
<a href="#" onclick="showPage('summary');return false" class="nav-item summary active" id="nav-summary"><span class="icon">📄</span>综述</a>
<div class="nav-count">子专题</div>
${childNavItems}
</div>
</div>
<div class="main-content">
${pages.map((p, i) => `<iframe id="frame-child-${i}" style="display:none" srcdoc="${injectCSS(p.html).replace(/"/g, '&quot;')}"></iframe>`).join('\n')}
<iframe id="frame-summary" srcdoc="${injectCSS(summaryHtml).replace(/"/g, '&quot;')}"></iframe>
</div>
<div class="print-content">
<div class="print-section"><h2>📄 综述: ${title}</h2>${summaryStripped}</div>
${pages.map((p, i) => `<div class="print-section"><h2>${i + 1}. ${p.title}</h2>${stripHtmlWrapper(p.html)}</div>`).join('\n')}
</div>
<script>
var current = 'summary';
function showPage(id) {
  document.getElementById('frame-' + current).style.display = 'none';
  var oldNav = document.getElementById('nav-' + current);
  oldNav.classList.remove('active');
  document.getElementById('frame-' + id).style.display = 'block';
  var newNav = document.getElementById('nav-' + id);
  newNav.classList.add('active');
  current = id;
}
</script>
</body>
</html>`;
    const blob = new Blob([exportHtml], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title}_深入分析.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleDrop = async (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const reordered = [...children];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setChildren(reordered);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sort_order !== i) {
        reordered[i].sort_order = i;
        updateEntry(reordered[i].id, { sort_order: i }).catch(() => {});
      }
    }
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
            children.map((c, idx) => (
              <div key={c.id} draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                onDragEnd={() => { if (dragIdx !== null && dragOverIdx !== null) handleDrop(dragIdx, dragOverIdx); setDragIdx(null); setDragOverIdx(null); }}
                onClick={() => setSelectedChild(c)}
                style={{ padding: '8px 10px', marginTop: 4, borderRadius: 6, cursor: 'grab',
                  background: dragOverIdx === idx ? '#2a2d55' : selectedChild?.id === c.id ? '#2a2d45' : '#1c1f2e',
                  borderLeft: `3px solid ${getCatColor(c.tags)}`, transition: 'background 0.15s',
                  opacity: dragIdx === idx ? 0.5 : 1 }}
                onMouseEnter={ev => { if (selectedChild?.id !== c.id && dragIdx === null) ev.currentTarget.style.background = '#222640'; }}
                onMouseLeave={ev => { if (selectedChild?.id !== c.id && dragIdx === null) ev.currentTarget.style.background = '#1c1f2e'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#555', fontSize: 10, cursor: 'grab' }}>⠿</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.title}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.content}
                    </div>
                  </div>
                </div>
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
            key={selectedChild.id}
            entry={selectedChild}
            allEntries={children}
            onClose={() => setSelectedChild(null)}
            onDeleted={() => { setSelectedChild(null); loadData(); }}
            onNavigate={(entry) => setSelectedChild(entry)}
            onUpdated={loadData}
            sharedCacheRef={childCacheRef}
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Summary toolbar */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #2a2d35', background: '#161822', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                📄 {parentEntry.title} — 综述
                {parentTopicVersion > 0 && <span style={{ fontSize: 11, color: '#34a853', marginLeft: 6 }}>v{parentTopicVersion}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleExport}
                  style={{ padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12,
                    background: '#1565c033', color: '#64b5f6', cursor: 'pointer' }}>
                  📥 导出HTML
                </button>
              </div>
            </div>
            {parentTopicHTML ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <iframe srcDoc={parentTopicHTML} style={{ flex: 1, border: 'none', background: '#0f1117' }} title="综述页面"
                onLoad={e => { try { const d = e.target.contentDocument; const s = d.createElement('style'); s.textContent = '* { max-width: 100% !important; box-sizing: border-box !important; } body { width: 100% !important; margin: 0 !important; padding: 16px 24px !important; }'; d.head.appendChild(s); } catch {} }} />
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
