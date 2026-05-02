import React, { useState } from 'react';
import { askQuestion, saveQACards } from '../lib/api.js';

export default function QAPanel({ onSaved }) {
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedCards, setSelectedCards] = useState(new Set());

  const handleAsk = async () => {
    if (!question.trim() || asking) return;
    setAsking(true);
    setResult(null);
    try {
      const data = await askQuestion(question.trim());
      setResult(data);
      if (data.suggestedCards) setSelectedCards(new Set(data.suggestedCards.map((_, i) => i)));
    } catch (err) {
      setResult({ answer: `错误: ${err.message}`, suggestedCards: [] });
    } finally { setAsking(false); }
  };

  const toggleCard = (i) => {
    const s = new Set(selectedCards);
    s.has(i) ? s.delete(i) : s.add(i);
    setSelectedCards(s);
  };

  const handleSave = async () => {
    if (!result?.suggestedCards?.length) return;
    setSaving(true);
    try {
      const cards = result.suggestedCards.filter((_, i) => selectedCards.has(i));
      if (cards.length === 0) return;
      await saveQACards(question, cards);
      setResult(null);
      setQuestion('');
      setSelectedCards(new Set());
      if (onSaved) onSaved();
    } finally { setSaving(false); }
  };

  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #2a2d45', background: '#1c1f2e', color: '#ddd', fontSize: 13, boxSizing: 'border-box' };

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2d35' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 8 }}>知识问答</div>

      <textarea value={question} onChange={e => setQuestion(e.target.value)}
        placeholder="输入你的问题，例如：北宋和唐朝的政治制度有什么区别？"
        rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, marginBottom: 6 }}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }} />

      <button onClick={handleAsk} disabled={asking || !question.trim()}
        style={{ width: '100%', padding: '7px', borderRadius: 6, border: 'none', cursor: asking ? 'wait' : 'pointer',
          background: asking ? '#333' : '#9c27b0', color: '#fff', fontSize: 13, marginBottom: 8 }}>
        {asking ? 'AI 思考中...' : '提问'}
      </button>

      {result && (
        <div style={{ background: '#1c1f2e', borderRadius: 8, padding: '12px 14px', marginTop: 4 }}>
          <div style={{ fontSize: 12, color: '#9c27b0', fontWeight: 600, marginBottom: 6 }}>AI 回答</div>
          <div style={{ fontSize: 13, color: '#ddd', lineHeight: 1.8, marginBottom: 12, whiteSpace: 'pre-wrap' }}>
            {result.answer}
          </div>

          {result.relatedEntries?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>参考了 {result.relatedEntries.length} 个已有知识</div>
            </div>
          )}

          {result.suggestedCards?.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>建议生成的知识卡片（点击选择/取消）：</div>
              {result.suggestedCards.map((card, i) => (
                <div key={i} onClick={() => toggleCard(i)}
                  style={{ padding: '8px 10px', marginBottom: 4, borderRadius: 6, cursor: 'pointer',
                    background: selectedCards.has(i) ? '#2a1a3a' : '#161822',
                    border: selectedCards.has(i) ? '1px solid #9c27b0' : '1px solid #2a2d35',
                    transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{selectedCards.has(i) ? '☑' : '☐'}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#ddd' }}>{card.title}</span>
                    <span style={{ fontSize: 10, color: '#888', marginLeft: 'auto' }}>{card.subject}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 3, marginLeft: 20 }}>{card.content.slice(0, 80)}...</div>
                  {card.tags?.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4, marginLeft: 20 }}>
                      {card.tags.slice(0, 4).map((t, j) => (
                        <span key={j} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: '#1c1f2e', color: '#666' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <button onClick={handleSave} disabled={saving || selectedCards.size === 0}
                style={{ width: '100%', padding: '7px', borderRadius: 6, border: 'none', marginTop: 8,
                  cursor: saving ? 'wait' : 'pointer',
                  background: selectedCards.size === 0 ? '#333' : '#9c27b0', color: '#fff', fontSize: 13 }}>
                {saving ? '保存中...' : `保存 ${selectedCards.size} 张卡片`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
