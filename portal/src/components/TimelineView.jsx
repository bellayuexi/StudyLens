import React, { useMemo } from 'react';

const SUBJECT_COLORS_MAP = {};
const PALETTE = ['#4285f4', '#ea4335', '#34a853', '#fbbc05', '#9c27b0', '#ff6d00', '#00bcd4', '#e91e63'];
let ci = 0;
function getColor(s) {
  if (!s) return '#999';
  if (!SUBJECT_COLORS_MAP[s]) SUBJECT_COLORS_MAP[s] = PALETTE[ci++ % PALETTE.length];
  return SUBJECT_COLORS_MAP[s];
}

// Dynasty ordering
const DYNASTY_ORDER = {
  '历史-隋朝': { order: 1, range: '581-618年' },
  '历史-唐朝': { order: 2, range: '618-907年' },
  '历史-辽': { order: 3, range: '916-1125年' },
  '历史-北宋': { order: 4, range: '960-1127年' },
  '历史-西夏': { order: 5, range: '1038-1227年' },
  '历史-金': { order: 6, range: '1115-1234年' },
  '历史-南宋': { order: 7, range: '1127-1279年' },
  '历史-宋朝': { order: 7.5, range: '960-1279年' },
  '历史-元朝': { order: 8, range: '1271-1368年' },
};

function getDynastyOrder(subject) {
  return DYNASTY_ORDER[subject]?.order ?? 99;
}

function getDynastyRange(subject) {
  return DYNASTY_ORDER[subject]?.range ?? '';
}

function extractYear(content) {
  const match = content.match(/(\d{3,4})年/);
  return match ? parseInt(match[1]) : null;
}

export default function TimelineView({ entries, onEntryClick, selectedId }) {
  const timeline = useMemo(() => {
    // Group by subject (dynasty)
    const groups = {};
    entries.forEach(e => {
      const key = e.subject || '其他';
      if (!groups[key]) groups[key] = [];
      groups[key].push({ ...e, year: extractYear(e.content) });
    });

    // Sort groups by dynasty order, then sort items within each group by year
    return Object.entries(groups)
      .sort(([a], [b]) => getDynastyOrder(a) - getDynastyOrder(b))
      .map(([subject, items]) => ({
        subject,
        range: getDynastyRange(subject),
        items: items.sort((a, b) => (a.year || 9999) - (b.year || 9999)),
      }));
  }, [entries]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 30px', background: '#0f1117' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ position: 'relative', paddingLeft: 80 }}>
          <div style={{ position: 'absolute', left: 64, top: 0, bottom: 0, width: 2, background: '#2a2d35' }} />

          {timeline.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 28 }}>
              {/* Dynasty header */}
              <div style={{ position: 'relative', marginBottom: 12, marginTop: gi > 0 ? 16 : 0 }}>
                <div style={{ position: 'absolute', left: -22, top: 6, width: 14, height: 14,
                  borderRadius: '50%', background: getColor(group.subject), border: '3px solid #0f1117' }} />
                <div style={{ fontSize: 17, fontWeight: 700, color: getColor(group.subject) }}>
                  {group.subject.replace('历史-', '')}
                </div>
                {group.range && (
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{group.range} · {group.items.length}个知识点</div>
                )}
              </div>

              {group.items.map((e) => {
                const isSelected = e.id === selectedId;
                return (
                  <div key={e.id} style={{ position: 'relative', marginBottom: 6 }}>
                    <div style={{
                      position: 'absolute', left: -19, top: 14, width: 8, height: 8,
                      borderRadius: '50%', background: getColor(e.subject),
                      border: isSelected ? '2px solid #fff' : '2px solid #0f1117',
                    }} />

                    {e.year && (
                      <div style={{ position: 'absolute', left: -76, top: 12, width: 50, textAlign: 'right',
                        fontSize: 11, color: '#888', fontWeight: 500 }}>
                        {e.year}年
                      </div>
                    )}

                    <div onClick={() => onEntryClick(e)}
                      style={{
                        padding: '10px 14px', marginLeft: 8, borderRadius: 8, cursor: 'pointer',
                        background: isSelected ? '#2a2d45' : '#161822',
                        borderLeft: `3px solid ${getColor(e.subject)}`,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={ev => { if (!isSelected) ev.currentTarget.style.background = '#1c2030'; }}
                      onMouseLeave={ev => { if (!isSelected) ev.currentTarget.style.background = '#161822'; }}>

                      <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 3 }}>{e.title}</div>
                      <div style={{ fontSize: 13, color: '#bbb', lineHeight: 1.6 }}>{e.content}</div>
                      {(e.tags || []).length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                          {e.tags.slice(0, 5).map((t, j) => (
                            <span key={j} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: '#1c1f2e', color: '#777' }}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
