import React, { useState, useRef, useEffect } from 'react';
import { askQuestion, saveQACards, buildQAMindMap } from '../lib/api.js';

function ComparisonView({ data }) {
  const cols = data.columns || [];
  const categories = [...new Set(cols.flatMap(c => (c.items || []).map(it => it.category)))];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 20 }}>
        {data.title}
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
        {cols.map((col, ci) => (
          <div key={ci} style={{ flex: 1, maxWidth: 360 }}>
            <div style={{ padding: '12px 16px', borderRadius: '10px 10px 0 0', textAlign: 'center',
              background: col.color || '#4285f4', color: '#fff', fontSize: 16, fontWeight: 600 }}>
              {col.header}
            </div>
            <div style={{ border: `1px solid ${col.color || '#4285f4'}33`, borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              {categories.map((cat, ri) => {
                const item = (col.items || []).find(it => it.category === cat);
                return (
                  <div key={ri} style={{ display: 'flex', borderBottom: ri < categories.length - 1 ? '1px solid #2a2d35' : 'none' }}>
                    <div style={{ width: 90, padding: '10px 12px', background: '#1a1d2a', fontSize: 12, color: '#888',
                      display: 'flex', alignItems: 'center', borderRight: '1px solid #2a2d35', flexShrink: 0 }}>
                      {cat}
                    </div>
                    <div style={{ flex: 1, padding: '10px 14px', fontSize: 13, color: '#ddd', lineHeight: 1.6, background: '#161822' }}>
                      {item?.content || '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {data.summary && (
        <div style={{ textAlign: 'center', marginTop: 16, padding: '10px 20px', borderRadius: 8,
          background: '#1c1f2e', color: '#fbbc05', fontSize: 13, lineHeight: 1.6 }}>
          {data.summary}
        </div>
      )}
    </div>
  );
}

function TimelineView({ data }) {
  const steps = data.steps || [];
  return (
    <div style={{ padding: 24 }}>
      <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 24 }}>
        {data.title}
      </div>
      <div style={{ position: 'relative', maxWidth: 500, margin: '0 auto' }}>
        <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, width: 2, background: '#2a2d45' }} />
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', marginBottom: 20, position: 'relative' }}>
            <div style={{ width: 34, flexShrink: 0, display: 'flex', justifyContent: 'center', zIndex: 1 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#4285f4', marginTop: 4,
                border: '2px solid #0f1117' }} />
            </div>
            <div style={{ flex: 1, background: '#1c1f2e', borderRadius: 8, padding: '12px 16px', marginLeft: 8,
              borderLeft: '3px solid #4285f4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{step.label}</span>
                {step.date && <span style={{ fontSize: 11, color: '#888' }}>{step.date}</span>}
              </div>
              <div style={{ fontSize: 13, color: '#bbb', lineHeight: 1.6 }}>{step.content}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TreeView({ data }) {
  const branches = data.branches || [];
  const colors = ['#4285f4', '#ea4335', '#34a853', '#fbbc05', '#9c27b0', '#ff6d00'];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <span style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 20, fontSize: 16,
          fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg, #4285f4, #9c27b0)' }}>
          {data.title}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        {branches.map((branch, bi) => {
          const color = colors[bi % colors.length];
          return (
            <div key={bi} style={{ minWidth: 200, maxWidth: 280, flex: '1 1 200px' }}>
              <div style={{ padding: '10px 14px', borderRadius: '8px 8px 0 0', textAlign: 'center',
                background: color, color: '#fff', fontSize: 14, fontWeight: 600 }}>
                {branch.label}
              </div>
              <div style={{ borderRadius: '0 0 8px 8px', border: `1px solid ${color}44`, borderTop: 'none', overflow: 'hidden' }}>
                {(branch.children || []).map((child, ci) => (
                  <div key={ci} style={{ padding: '10px 14px', borderBottom: ci < branch.children.length - 1 ? '1px solid #2a2d35' : 'none',
                    background: '#161822' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#ddd', marginBottom: 2 }}>{child.label}</div>
                    {child.detail && (
                      <div style={{ fontSize: 12, color: '#999', lineHeight: 1.5 }}>{child.detail}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StructuredViz({ data }) {
  if (!data || !data.type) return null;
  switch (data.type) {
    case 'comparison': return <ComparisonView data={data} />;
    case 'timeline': return <TimelineView data={data} />;
    case 'tree': return <TreeView data={data} />;
    default: return null;
  }
}

export default function QAPage({ onSaved }) {
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState([]);
  const [latestCards, setLatestCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [vizData, setVizData] = useState(null);
  const [buildingViz, setBuildingViz] = useState(false);
  const chatRef = useRef(null);

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

      setBuildingViz(true);
      try {
        const vd = await buildQAMindMap(q, data.answer, data.suggestedCards || [], data.relatedEntries || []);
        if (vd && vd.type) setVizData(vd);
      } catch (vizErr) {
        console.error('Viz generation failed:', vizErr);
      }
      setBuildingViz(false);
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
    setVizData(null);
    setInput('');
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: '#0f1117' }}>
      {/* Left: Chat */}
      <div style={{ width: 400, minWidth: 350, display: 'flex', flexDirection: 'column', borderRight: '1px solid #2a2d35', background: '#161822' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a2d35', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>💬 知识问答</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>多轮对话 · 结构化知识可视化</div>
          </div>
          {messages.length > 0 && (
            <span onClick={handleReset} style={{ fontSize: 12, color: '#666', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, background: '#1c1f2e' }}>
              新对话
            </span>
          )}
        </div>

        <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#555', marginTop: 60 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🧠</div>
              <div style={{ fontSize: 14 }}>输入问题开始探索</div>
              <div style={{ fontSize: 12, marginTop: 8, color: '#444', lineHeight: 1.8 }}>
                对比类问题 → 左右对比卡片<br />
                时间线问题 → 时间轴展示<br />
                其他问题 → 知识树展示
              </div>
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
          {asking && <div style={{ fontSize: 12, color: '#9c27b0', padding: '8px 0' }}>AI 思考中...</div>}
        </div>

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

      {/* Right: Structured Visualization */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!vizData && !buildingViz && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#444' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 15 }}>知识可视化</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>提问后自动生成结构化展示</div>
            </div>
          </div>
        )}
        {buildingViz && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9c27b0' }}>
            <div style={{ fontSize: 14 }}>正在生成知识图表...</div>
          </div>
        )}
        {vizData && <StructuredViz data={vizData} />}
      </div>
    </div>
  );
}
