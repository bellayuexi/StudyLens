import React, { useState, useRef, useEffect } from 'react';
import { askQuestion, saveQACards } from '../lib/api.js';

export default function QAPanel({ onSaved }) {
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState([]);
  const [latestCards, setLatestCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [expanded, setExpanded] = useState(false);
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
      setMessages([]);
      setLatestCards([]);
      setSelectedCards(new Set());
      setExpanded(false);
      if (onSaved) onSaved();
    } finally { setSaving(false); }
  };

  const handleReset = () => {
    setMessages([]);
    setLatestCards([]);
    setSelectedCards(new Set());
    setInput('');
  };

  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #2a2d45', background: '#1c1f2e', color: '#ddd', fontSize: 13, boxSizing: 'border-box' };

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2d35' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div onClick={() => setExpanded(!expanded)} style={{ fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
          {expanded ? '▾' : '▸'} 知识问答
          {messages.length > 0 && <span style={{ fontSize: 10, color: '#9c27b0', marginLeft: 6 }}>{Math.ceil(messages.length / 2)}轮</span>}
        </div>
        {messages.length > 0 && (
          <span onClick={handleReset} style={{ fontSize: 11, color: '#666', cursor: 'pointer' }}>新对话</span>
        )}
      </div>

      {expanded && (
        <>
          {/* Chat messages */}
          {messages.length > 0 && (
            <div ref={chatRef} style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 8, padding: '4px 0' }}>
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 8, display: 'flex', flexDirection: 'column',
                  alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '90%', padding: '8px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                    background: m.role === 'user' ? '#2a2d55' : '#1c1f2e',
                    color: m.role === 'user' ? '#8ab4f8' : '#ddd',
                    borderBottomRightRadius: m.role === 'user' ? 2 : 10,
                    borderBottomLeftRadius: m.role === 'ai' ? 2 : 10,
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {asking && (
                <div style={{ fontSize: 12, color: '#9c27b0', padding: '4px 0' }}>AI 思考中...</div>
              )}
            </div>
          )}

          {/* Input */}
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              placeholder={messages.length > 0 ? '继续追问...' : '输入问题...'}
              style={{ ...inputStyle, flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAsk(); } }} />
            <button onClick={handleAsk} disabled={asking || !input.trim()}
              style={{ padding: '0 14px', borderRadius: 6, border: 'none', cursor: asking ? 'wait' : 'pointer',
                background: asking ? '#333' : '#9c27b0', color: '#fff', fontSize: 13, flexShrink: 0 }}>
              {messages.length > 0 ? '追问' : '提问'}
            </button>
          </div>

          {/* Knowledge cards from latest answer */}
          {latestCards.length > 0 && !asking && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>
                建议知识卡片（满意后保存，或继续追问优化）：
              </div>
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
                style={{ width: '100%', padding: '7px', borderRadius: 6, border: 'none', marginTop: 6,
                  cursor: saving ? 'wait' : 'pointer',
                  background: selectedCards.size === 0 ? '#333' : '#34a853', color: '#fff', fontSize: 13 }}>
                {saving ? '保存中...' : `保存 ${selectedCards.size} 张卡片到知识库`}
              </button>
            </div>
          )}
        </>
      )}

      {!expanded && messages.length === 0 && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            placeholder="输入问题..."
            style={{ ...inputStyle, flex: 1 }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setExpanded(true); handleAsk(); } }} />
          <button onClick={() => { setExpanded(true); handleAsk(); }} disabled={asking || !input.trim()}
            style={{ padding: '0 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: '#9c27b0', color: '#fff', fontSize: 13, flexShrink: 0 }}>
            提问
          </button>
        </div>
      )}
    </div>
  );
}
