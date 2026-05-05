import React, { useMemo, useState } from 'react';

const SUBJECT_COLORS_MAP = {};
const PALETTE = ['#4285f4', '#ea4335', '#34a853', '#fbbc05', '#9c27b0', '#ff6d00', '#00bcd4', '#e91e63'];
let ci = 0;
function getColor(s) {
  if (!s) return '#999';
  if (!SUBJECT_COLORS_MAP[s]) SUBJECT_COLORS_MAP[s] = PALETTE[ci++ % PALETTE.length];
  return SUBJECT_COLORS_MAP[s];
}

const DYNASTY_ORDER = {
  '历史-隋朝': { order: 1, start: 581, end: 618, label: '隋朝' },
  '历史-唐朝': { order: 2, start: 618, end: 907, label: '唐朝' },
  '历史-辽':   { order: 3, start: 916, end: 1125, label: '辽' },
  '历史-北宋': { order: 4, start: 960, end: 1127, label: '北宋' },
  '历史-西夏': { order: 5, start: 1038, end: 1227, label: '西夏' },
  '历史-金':   { order: 6, start: 1115, end: 1234, label: '金' },
  '历史-南宋': { order: 7, start: 1127, end: 1279, label: '南宋' },
  '历史-宋朝': { order: 7.5, start: 960, end: 1279, label: '宋朝' },
  '历史-元朝': { order: 8, start: 1271, end: 1368, label: '元朝' },
};

function getDynastyInfo(subject) {
  return DYNASTY_ORDER[subject] || { order: 99, start: null, end: null, label: subject?.replace('历史-', '') || '其他' };
}

function extractYear(content) {
  const match = content.match(/(\d{3,4})年/);
  return match ? parseInt(match[1]) : null;
}

export default function TimelineView({ entries, onEntryClick, selectedId, compact }) {
  const [onlyDated, setOnlyDated] = useState(false);

  const timeline = useMemo(() => {
    const groups = {};
    entries.forEach(e => {
      const key = e.subject || '其他';
      if (!groups[key]) groups[key] = [];
      groups[key].push({ ...e, year: extractYear(e.content) });
    });

    return Object.entries(groups)
      .sort(([a], [b]) => getDynastyInfo(a).order - getDynastyInfo(b).order)
      .map(([subject, items]) => {
        const info = getDynastyInfo(subject);
        const dated = items.filter(i => i.year !== null).sort((a, b) => a.year - b.year);
        const undated = items.filter(i => i.year === null);
        return { subject, info, dated, undated, all: items };
      });
  }, [entries]);

  const renderCompactEntry = (e) => {
    const isSelected = e.id === selectedId;
    return (
      <div key={e.id} onClick={() => onEntryClick(e)}
        style={{ padding: '6px 10px', marginBottom: 3, borderRadius: 6, cursor: 'pointer',
          background: isSelected ? '#2a2d45' : '#1c1f2e',
          borderLeft: `3px solid ${getColor(e.subject)}`, transition: 'background 0.15s' }}
        onMouseEnter={ev => { if (!isSelected) ev.currentTarget.style.background = '#222640'; }}
        onMouseLeave={ev => { if (!isSelected) ev.currentTarget.style.background = '#1c1f2e'; }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#ddd' }}>
          {e.year && <span style={{ color: '#888', marginRight: 4, fontSize: 10 }}>{e.year}年</span>}
          {e.title}
        </div>
      </div>
    );
  };

  const renderEntry = (e, isIndented) => {
    const isSelected = e.id === selectedId;
    return (
      <div key={e.id} style={{ position: 'relative', marginBottom: 6, marginLeft: isIndented ? 24 : 0 }}>
        <div style={{
          position: 'absolute', left: -19, top: 14, width: isIndented ? 6 : 8, height: isIndented ? 6 : 8,
          borderRadius: '50%', background: getColor(e.subject),
          border: isSelected ? '2px solid #fff' : '2px solid #0f1117',
          opacity: isIndented ? 0.6 : 1,
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
            opacity: isIndented ? 0.85 : 1,
          }}
          onMouseEnter={ev => { if (!isSelected) ev.currentTarget.style.background = '#1c2030'; }}
          onMouseLeave={ev => { if (!isSelected) ev.currentTarget.style.background = '#161822'; }}>

          <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 3 }}>
            {e.title}
            {!e.year && <span style={{ fontSize: 10, color: '#666', marginLeft: 6 }}>（无明确年份）</span>}
          </div>
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
  };

  const renderDynastyMarker = (label, year, color, type) => (
    <div style={{ position: 'relative', marginBottom: 6 }}>
      <div style={{
        position: 'absolute', left: -22, top: 4, width: 14, height: 14,
        borderRadius: type === 'start' ? '50%' : 2,
        background: color, border: '3px solid #0f1117',
      }} />
      <div style={{ position: 'absolute', left: -76, top: 4, width: 50, textAlign: 'right', fontSize: 11, color: '#aaa', fontWeight: 600 }}>
        {year}年
      </div>
      <div style={{ marginLeft: 8, padding: '4px 12px', fontSize: 13, color: '#aaa', fontStyle: 'italic' }}>
        {type === 'start' ? `── ${label} 建立` : `── ${label} 灭亡 ──`}
      </div>
    </div>
  );

  if (compact) {
    return (
      <div style={{ padding: '6px 10px' }}>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>
          {entries.length} 个知识点（时间线）
        </div>
        {timeline.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: getColor(group.subject), marginBottom: 4 }}>
              {group.info.label}
              {group.info.start && <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>{group.info.start}—{group.info.end}</span>}
            </div>
            {[...group.dated, ...(onlyDated ? [] : group.undated)].map(e => renderCompactEntry(e))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 30px', background: '#0f1117' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Filter toggle */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setOnlyDated(!onlyDated)}
            style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
              background: onlyDated ? '#4285f4' : '#1c1f2e', color: onlyDated ? '#fff' : '#aaa' }}>
            {onlyDated ? '✓ 仅显示有明确时间的' : '显示全部'}
          </button>
          <span style={{ fontSize: 11, color: '#666' }}>
            {onlyDated
              ? `${entries.filter(e => extractYear(e.content) !== null).length} 个有明确时间`
              : `共 ${entries.length} 个知识点`}
          </span>
        </div>

        <div style={{ position: 'relative', paddingLeft: 80 }}>
          <div style={{ position: 'absolute', left: 64, top: 0, bottom: 0, width: 2, background: '#2a2d35' }} />

          {timeline.map((group, gi) => {
            const color = getColor(group.subject);
            const hasStart = group.info.start !== null;
            const visibleDated = group.dated;
            const visibleUndated = onlyDated ? [] : group.undated;

            if (onlyDated && visibleDated.length === 0) return null;

            return (
              <div key={gi} style={{ marginBottom: 28 }}>
                {/* Dynasty header */}
                <div style={{ position: 'relative', marginBottom: 12, marginTop: gi > 0 ? 16 : 0 }}>
                  <div style={{ position: 'absolute', left: -22, top: 6, width: 14, height: 14,
                    borderRadius: '50%', background: color, border: '3px solid #0f1117' }} />
                  <div style={{ fontSize: 17, fontWeight: 700, color }}>
                    {group.info.label}
                  </div>
                  {hasStart && (
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      {group.info.start}—{group.info.end}年 · {onlyDated ? visibleDated.length : group.all.length}个知识点
                      {visibleUndated.length > 0 && ` (${visibleUndated.length}个无明确年份)`}
                    </div>
                  )}
                </div>

                {/* Start marker */}
                {hasStart && renderDynastyMarker(group.info.label, group.info.start, color, 'start')}

                {/* Dated entries */}
                {visibleDated.map(e => renderEntry(e, false))}

                {/* Undated entries (indented) */}
                {visibleUndated.length > 0 && (
                  <>
                    {visibleUndated.length > 0 && !onlyDated && (
                      <div style={{ marginLeft: 32, fontSize: 11, color: '#555', marginBottom: 4, marginTop: 8 }}>
                        ── 其他相关知识 ──
                      </div>
                    )}
                    {visibleUndated.map(e => renderEntry(e, true))}
                  </>
                )}

                {/* End marker */}
                {hasStart && renderDynastyMarker(group.info.label, group.info.end, color, 'end')}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
