import React, { useRef, useEffect, useCallback, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function KnowledgeGraph({ data, onNodeClick, selectedId }) {
  const fgRef = useRef();
  const [focusSubject, setFocusSubject] = useState(null);
  const [focusNodeId, setFocusNodeId] = useState(null);

  const connectedTo = useCallback((nodeId) => {
    const ids = new Set();
    data.links.forEach(l => {
      const src = typeof l.source === 'object' ? l.source.id : l.source;
      const tgt = typeof l.target === 'object' ? l.target.id : l.target;
      if (src === nodeId) ids.add(tgt);
      if (tgt === nodeId) ids.add(src);
    });
    return ids;
  }, [data.links]);

  const isHighlighted = useCallback((node) => {
    if (!focusSubject && !focusNodeId) return true;
    if (focusNodeId) {
      if (node.id === focusNodeId) return true;
      return connectedTo(focusNodeId).has(node.id);
    }
    if (focusSubject) return node.subject === focusSubject;
    return true;
  }, [focusSubject, focusNodeId, connectedTo]);

  const isLinkHighlighted = useCallback((link) => {
    if (!focusSubject && !focusNodeId) return true;
    const src = typeof link.source === 'object' ? link.source.id : link.source;
    const tgt = typeof link.target === 'object' ? link.target.id : link.target;
    if (focusNodeId) return src === focusNodeId || tgt === focusNodeId;
    if (focusSubject) {
      const srcNode = data.nodes.find(n => n.id === src);
      const tgtNode = data.nodes.find(n => n.id === tgt);
      return srcNode?.subject === focusSubject && tgtNode?.subject === focusSubject;
    }
    return true;
  }, [focusSubject, focusNodeId, data.nodes]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || data.nodes.length === 0) return;

    const subjects = [...new Set(data.nodes.map(n => n.subject).filter(Boolean))];
    const clusterCenters = {};
    const angleStep = (2 * Math.PI) / Math.max(subjects.length, 1);
    const clusterRadius = 150;
    subjects.forEach((s, i) => {
      clusterCenters[s] = {
        x: Math.cos(angleStep * i) * clusterRadius,
        y: Math.sin(angleStep * i) * clusterRadius,
      };
    });

    fg.d3Force('cluster', (alpha) => {
      data.nodes.forEach(node => {
        const center = clusterCenters[node.subject];
        if (!center) return;
        const k = alpha * 0.3;
        node.vx += (center.x - node.x) * k;
        node.vy += (center.y - node.y) * k;
      });
    });

    fg.d3Force('charge')?.strength(-100);
    fg.d3Force('center')?.strength(0.05);
    fg.d3ReheatSimulation();
    setTimeout(() => fg.zoomToFit(400, 60), 800);
  }, [data]);

  // Zoom to focused subject cluster
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (focusSubject) {
      const subjectNodes = data.nodes.filter(n => n.subject === focusSubject);
      if (subjectNodes.length > 0) {
        const cx = subjectNodes.reduce((s, n) => s + (n.x || 0), 0) / subjectNodes.length;
        const cy = subjectNodes.reduce((s, n) => s + (n.y || 0), 0) / subjectNodes.length;
        fg.centerAt(cx, cy, 600);
        fg.zoom(2.5, 600);
      }
    } else if (!focusNodeId) {
      fg.zoomToFit(400, 60);
    }
  }, [focusSubject, data.nodes]);

  // Zoom to focused node
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !focusNodeId) return;
    const node = data.nodes.find(n => n.id === focusNodeId);
    if (node && node.x != null) {
      fg.centerAt(node.x, node.y, 600);
      fg.zoom(3, 600);
    }
  }, [focusNodeId, data.nodes]);

  const handleClick = useCallback((node) => {
    if (focusNodeId === node.id) {
      setFocusNodeId(null);
      setFocusSubject(null);
    } else if (focusSubject === node.subject && !focusNodeId) {
      setFocusNodeId(node.id);
    } else {
      setFocusSubject(node.subject);
      setFocusNodeId(null);
    }
    onNodeClick(node);
  }, [focusSubject, focusNodeId, onNodeClick]);

  const handleBgClick = useCallback(() => {
    setFocusSubject(null);
    setFocusNodeId(null);
  }, []);

  const renderNode = useCallback((node, ctx, globalScale) => {
    const isSelected = node.id === selectedId;
    const highlighted = isHighlighted(node);
    const dimmed = !highlighted;
    const r = Math.sqrt(node.val) * 3.5;
    const alpha = dimmed ? 0.15 : 1;

    ctx.globalAlpha = alpha;

    // Glow for selected
    if (isSelected && !dimmed) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 6, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(66, 133, 244, 0.25)';
      ctx.fill();
    }

    if (node.isQA) {
      // Rounded rectangle for Q&A nodes (softer than diamond)
      const w = r * 2.2, h = r * 1.6;
      const cr = 4;
      const x = node.x - w / 2, y = node.y - h / 2;
      ctx.beginPath();
      ctx.moveTo(x + cr, y);
      ctx.lineTo(x + w - cr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + cr);
      ctx.lineTo(x + w, y + h - cr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - cr, y + h);
      ctx.lineTo(x + cr, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - cr);
      ctx.lineTo(x, y + cr);
      ctx.quadraticCurveTo(x, y, x + cr, y);
      ctx.closePath();
      ctx.fillStyle = isSelected ? '#fff' : node.color;
      ctx.fill();
      ctx.strokeStyle = '#b39ddb';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? '#fff' : node.color;
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Label
    const fontSize = Math.max(11 / globalScale, 3.5);
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const textWidth = ctx.measureText(node.name).width;
    const bgPad = 2 / globalScale;
    ctx.fillStyle = 'rgba(15, 17, 23, 0.75)';
    ctx.fillRect(node.x - textWidth / 2 - bgPad, node.y + r + 2 / globalScale, textWidth + bgPad * 2, fontSize + bgPad * 2);

    ctx.fillStyle = dimmed ? '#555' : (isSelected ? '#fff' : '#ccc');
    ctx.fillText(node.name, node.x, node.y + r + 3 / globalScale);

    ctx.globalAlpha = 1;
  }, [selectedId, isHighlighted]);

  const renderLink = useCallback((link, ctx, globalScale) => {
    const highlighted = isLinkHighlighted(link);
    const src = link.source;
    const tgt = link.target;
    if (!src.x || !tgt.x) return;

    ctx.globalAlpha = highlighted ? 0.4 : 0.06;

    // Cross-subject links are dashed
    const crossSubject = src.subject !== tgt.subject;

    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.strokeStyle = crossSubject ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = highlighted ? 1.5 : 0.8;
    if (crossSubject) {
      ctx.setLineDash([4, 4]);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow
    if (highlighted) {
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const ux = dx / len, uy = dy / len;
        const arrowPos = 0.85;
        const ax = src.x + dx * arrowPos, ay = src.y + dy * arrowPos;
        const aLen = 4;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - ux * aLen + uy * aLen * 0.4, ay - uy * aLen - ux * aLen * 0.4);
        ctx.lineTo(ax - ux * aLen - uy * aLen * 0.4, ay - uy * aLen + ux * aLen * 0.4);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fill();
      }
    }

    // Label
    if (link.label && globalScale > 1.5 && highlighted) {
      const midX = (src.x + tgt.x) / 2;
      const midY = (src.y + tgt.y) / 2;
      const fontSize = Math.max(9 / globalScale, 3);
      ctx.font = `${fontSize}px system-ui`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.fillText(link.label, midX, midY);
    }

    ctx.globalAlpha = 1;
  }, [isLinkHighlighted]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Focus hint */}
      {(focusSubject || focusNodeId) && (
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, background: 'rgba(22,24,34,0.9)',
          padding: '8px 14px', borderRadius: 8, fontSize: 12, color: '#aaa', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#fff' }}>
            {focusNodeId ? `聚焦: ${data.nodes.find(n => n.id === focusNodeId)?.name || ''}` : `学科: ${focusSubject}`}
          </span>
          <span onClick={handleBgClick} style={{ cursor: 'pointer', color: '#4285f4', fontSize: 11 }}>
            {focusNodeId ? '返回学科' : '查看全部'}
          </span>
        </div>
      )}

      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        nodeCanvasObject={renderNode}
        nodePointerAreaPaint={(node, color, ctx) => {
          const r = Math.sqrt(node.val) * 3.5 + 4;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkCanvasObject={renderLink}
        linkCanvasObjectMode={() => 'replace'}
        onNodeClick={handleClick}
        onBackgroundClick={handleBgClick}
        backgroundColor="#0f1117"
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.25}
        cooldownTicks={150}
      />
    </div>
  );
}
