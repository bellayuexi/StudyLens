import React, { useRef, useEffect, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function KnowledgeGraph({ data, onNodeClick, selectedId }) {
  const fgRef = useRef();

  // Cluster same-subject nodes together using custom forces
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || data.nodes.length === 0) return;

    // Group nodes by subject and compute cluster centers
    const subjects = [...new Set(data.nodes.map(n => n.subject).filter(Boolean))];
    const clusterCenters = {};
    const angleStep = (2 * Math.PI) / Math.max(subjects.length, 1);
    const clusterRadius = 120;
    subjects.forEach((s, i) => {
      clusterCenters[s] = {
        x: Math.cos(angleStep * i) * clusterRadius,
        y: Math.sin(angleStep * i) * clusterRadius,
      };
    });

    // Add clustering force
    fg.d3Force('cluster', (alpha) => {
      data.nodes.forEach(node => {
        const center = clusterCenters[node.subject];
        if (!center) return;
        const k = alpha * 0.3;
        node.vx += (center.x - node.x) * k;
        node.vy += (center.y - node.y) * k;
      });
    });

    // Increase charge to prevent overlap but keep nodes together
    fg.d3Force('charge')?.strength(-80);
    fg.d3Force('center')?.strength(0.05);

    // Reheat
    fg.d3ReheatSimulation();

    setTimeout(() => fg.zoomToFit(400, 60), 800);
  }, [data]);

  const renderNode = useCallback((node, ctx, globalScale) => {
    const isSelected = node.id === selectedId;
    const r = Math.sqrt(node.val) * 3.5;

    if (isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(66, 133, 244, 0.3)';
      ctx.fill();
    }

    if (node.isQA) {
      // Diamond shape for Q&A nodes
      ctx.beginPath();
      ctx.moveTo(node.x, node.y - r * 1.3);
      ctx.lineTo(node.x + r, node.y);
      ctx.lineTo(node.x, node.y + r * 1.3);
      ctx.lineTo(node.x - r, node.y);
      ctx.closePath();
      ctx.fillStyle = isSelected ? '#fff' : node.color;
      ctx.fill();
      ctx.strokeStyle = '#9c27b0';
      ctx.lineWidth = 2;
      ctx.stroke();
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

    const fontSize = Math.max(11 / globalScale, 3.5);
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const textWidth = ctx.measureText(node.name).width;
    const bgPad = 2 / globalScale;
    ctx.fillStyle = 'rgba(15, 17, 23, 0.8)';
    ctx.fillRect(node.x - textWidth / 2 - bgPad, node.y + r + 2 / globalScale, textWidth + bgPad * 2, fontSize + bgPad * 2);

    ctx.fillStyle = isSelected ? '#fff' : '#ccc';
    ctx.fillText(node.name, node.x, node.y + r + 3 / globalScale);
  }, [selectedId]);

  return (
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
      linkColor={() => 'rgba(255,255,255,0.15)'}
      linkWidth={1.5}
      linkDirectionalArrowLength={4}
      linkDirectionalArrowRelPos={0.9}
      linkCanvasObjectMode={() => 'after'}
      linkCanvasObject={(link, ctx, globalScale) => {
        if (!link.label || globalScale < 1.5) return;
        const midX = (link.source.x + link.target.x) / 2;
        const midY = (link.source.y + link.target.y) / 2;
        const fontSize = Math.max(9 / globalScale, 3);
        ctx.font = `${fontSize}px system-ui`;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.textAlign = 'center';
        ctx.fillText(link.label, midX, midY);
      }}
      onNodeClick={onNodeClick}
      backgroundColor="#0f1117"
      d3AlphaDecay={0.015}
      d3VelocityDecay={0.25}
      cooldownTicks={150}
    />
  );
}
