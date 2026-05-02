import React, { useState, useRef, useEffect, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { askQuestion, saveQACards, buildQAMindMap } from '../lib/api.js';

const NODE_COLORS = {
  question: '#ff6d00',
  answer: '#4285f4',
  concept: '#34a853',
  card: '#9c27b0',
  related: '#fbbc05',
};

export default function QAPage({ onSaved }) {
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState([]);
  const [latestCards, setLatestCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [mindMapData, setMindMapData] = useState({ nodes: [], links: [] });
  const [buildingMap, setBuildingMap] = useState(false);
  const chatRef = useRef(null);
  const graphRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const buildHistory = () => {
    const hist = [];
    for (let i = 0; i < messages.length; i += 2) {
      const q = messages[i];
      const a = messages[i + 1];
      if (q && a) hist.push({ question: q.text, answer: a.text, suggestedCards: a.cards || [] });
    }
    return hist;
  };

  const handleAsk = async () => {
    const q = input.trim();
    if (!q || asking) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setAsking(true);
    try {
      const history = buildHistory();
      const data = await askQuestion(q, history);
      setMessages(prev => [...prev, { role: 'ai', text: data.answer, cards: data.suggestedCards || [] }]);
      setLatestCards(data.suggestedCards || []);
      setSelectedCards(new Set((data.suggestedCards || []).map((_, i) => i)));

      setBuildingMap(true);
      try {
        const mapData = await buildQAMindMap(q, data.answer, data.suggestedCards || [], data.relatedEntries || []);
        if (mapData.nodes?.length > 0) {
          setMindMapData(mapData);
          setTimeout(() => { if (graphRef.current) graphRef.current.zoomToFit(400, 40); }, 500);
        }
      } catch (_) {}
      setBuildingMap(false);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: `错误: ${err.message}`, cards: [] }]);
      setLatestCards([]);
    } finally { setAsking(false); }
  };

  const toggleCard = (i) => {
    const s = new Set(selectedCards);
    s.has(i) ? s.delete(i) : s.add(i);
    setSelectedCards(s);
  };

  const handleSave = async () => {
    if (!latestCards.length) return;
    setSaving(true);
    try {
      const cards = latestCards.filter((_, i) => selectedCards.has(i));
      if (cards.length === 0) return;
      const firstQ = messages.find(m => m.role === 'user')?.text || '';
      await saveQACards(firstQ, cards);
      setLatestCards([]);
      setSelectedCards(new Set());
      if (onSaved) onSaved();
    } finally { setSaving(false); }
  };

  const handleReset = () => {
    setMessages([]);
    setLatestCards([]);
    setSelectedCards(new Set());
    setMindMapData({ nodes: [], links: [] });
    setInput('');
  };

  const paintNode = useCallback((node, ctx) => {
    const r = node.type === 'question' ? 10 : 7;
    const color = NODE_COLORS[node.type] || '#999';

    ctx.beginPath();
    if (node.type === 'question') {
      const s = r * 1.4;
      ctx.moveTo(node.x, node.y - s);
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const outerX = node.x + s * Math.cos(angle);
        const outerY = node.y + s * Math.sin(angle);
        ctx.lineTo(outerX, outerY);
        const innerAngle = angle + (2 * Math.PI) / 10;
        const innerX = node.x + (s * 0.45) * Math.cos(innerAngle);
        const innerY = node.y + (s * 0.45) * Math.sin(innerAngle);
        ctx.lineTo(innerX, innerY);
      }
      ctx.closePath();
    } else {
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    }
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = `${node.type === 'question' ? 'bold 11px' : '10px'} system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#e0e0e0';
    ctx.fillText(node.label || '', node.x, node.y + r + 3);
  }, []);

  const paintLink = useCallback((link, ctx) => {
    const src = link.source;
    const tgt = link.target;
    if (!src.x || !tgt.x) return;

    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (link.label) {
      const mx = (src.x + tgt.x) / 2;
      const my = (src.y + tgt.y) / 2;
      ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(link.label, mx, my);
    }
  }, []);

  return (
    <div style={{ display: 'flex', height: '100%', background: '#0f1117' }}>
      {/* Left: Chat */}
      <div style={{ width: 400, minWidth: 350, display: 'flex', flexDirection: 'column', borderRight: '1px solid #2a2d35', background: '#161822' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a2d35', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>💬 知识问答</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>多轮对话 · 思维导图可视化</div>
          </div>
          {messages.length > 0 && (
            <span onClick={handleReset} style={{ fontSize: 12, color: '#666', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, background: '#1c1f2e' }}>
              新对话
            </span>
          )}
        </div>

        {/* Messages */}
        <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#555', marginTop: 60 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🧠</div>
              <div style={{ fontSize: 14 }}>输入问题开始探索</div>
              <div style={{ fontSize: 12, marginTop: 6, color: '#444' }}>AI 会生成知识卡片和思维导图</div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 12, display: 'flex', flexDirection: 'column',
              alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '92%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap',
                background: m.role === 'user' ? '#2a2d55' : '#1c1f2e',
                color: m.role === 'user' ? '#8ab4f8' : '#ddd',
                borderBottomRightRadius: m.role === 'user' ? 2 : 12,
                borderBottomLeftRadius: m.role === 'ai' ? 2 : 12,
              }}>
                {m.text}
              </div>
            </div>
          ))}
          {asking && (
            <div style={{ fontSize: 12, color: '#9c27b0', padding: '8px 0' }}>AI 思考中...</div>
          )}
        </div>

        {/* Cards */}
        {latestCards.length > 0 && !asking && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid #2a2d35', maxHeight: 200, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>建议知识卡片：</div>
            {latestCards.map((card, i) => (
              <div key={i} onClick={() => toggleCard(i)}
                style={{ padding: '6px 10px', marginBottom: 3, borderRadius: 6, cursor: 'pointer', fontSize: 12,
                  background: selectedCards.has(i) ? '#2a1a3a' : '#161822',
                  border: selectedCards.has(i) ? '1px solid #9c27b0' : '1px solid #2a2d35' }}>
                <span style={{ marginRight: 6 }}>{selectedCards.has(i) ? '☑' : '☐'}</span>
                <span style={{ fontWeight: 500, color: '#ddd' }}>{card.title}</span>
                <span style={{ fontSize: 10, color: '#888', marginLeft: 6 }}>{card.subject}</span>
              </div>
            ))}
            <button onClick={handleSave} disabled={saving || selectedCards.size === 0}
              style={{ width: '100%', padding: '7px', borderRadius: 6, border: 'none', marginTop: 4,
                cursor: saving ? 'wait' : 'pointer',
                background: selectedCards.size === 0 ? '#333' : '#34a853', color: '#fff', fontSize: 13 }}>
              {saving ? '保存中...' : `保存 ${selectedCards.size} 张卡片到知识库`}
            </button>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #2a2d35' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              placeholder={messages.length > 0 ? '继续追问...' : '输入你的问题...'}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #2a2d45',
                background: '#1c1f2e', color: '#ddd', fontSize: 14, boxSizing: 'border-box' }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAsk(); } }} />
            <button onClick={handleAsk} disabled={asking || !input.trim()}
              style={{ padding: '0 18px', borderRadius: 8, border: 'none', cursor: asking ? 'wait' : 'pointer',
                background: asking ? '#333' : '#9c27b0', color: '#fff', fontSize: 14, flexShrink: 0 }}>
              {messages.length > 0 ? '追问' : '提问'}
            </button>
          </div>
        </div>
      </div>

      {/* Right: Mind Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        {mindMapData.nodes.length === 0 && !buildingMap && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            textAlign: 'center', color: '#444' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
            <div style={{ fontSize: 15 }}>思维导图</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>提问后自动生成知识关联图</div>
          </div>
        )}
        {buildingMap && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            textAlign: 'center', color: '#9c27b0' }}>
            <div style={{ fontSize: 14 }}>正在生成思维导图...</div>
          </div>
        )}
        {mindMapData.nodes.length > 0 && (
          <>
            <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, background: 'rgba(22,24,34,0.9)',
              padding: '8px 12px', borderRadius: 8, fontSize: 11 }}>
              <div style={{ color: '#888', marginBottom: 4 }}>图例</div>
              {Object.entries(NODE_COLORS).map(([type, color]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6 }} />
                  <span style={{ color: '#aaa' }}>
                    {{ question: '问题', answer: '要点', concept: '概念', card: '卡片', related: '关联' }[type] || type}
                  </span>
                </div>
              ))}
            </div>
            <ForceGraph2D
              ref={graphRef}
              graphData={mindMapData}
              nodeCanvasObject={paintNode}
              nodePointerAreaPaint={(node, color, ctx) => {
                ctx.beginPath();
                ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
              }}
              linkCanvasObject={paintLink}
              linkCanvasObjectMode={() => 'replace'}
              backgroundColor="#0f1117"
              d3AlphaDecay={0.04}
              d3VelocityDecay={0.3}
              warmupTicks={50}
              cooldownTicks={100}
            />
          </>
        )}
      </div>
    </div>
  );
}
