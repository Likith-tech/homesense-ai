// src/components/CorrelationGraph.jsx

import React from 'react';
/**
 * Simple correlation graph rendered as SVG.
 * It receives an array of edges like [{from: 'occupancy', to: 'ac'}]
 * and draws a vertical flow chart.
 */
export default function CorrelationGraph({ edges }) {
  if (!edges || edges.length === 0) return null;
  // layout: place each node vertically with equal spacing.
  const nodes = Array.from(new Set(edges.flatMap(e => [e.from, e.to])));
  const nodeY = {};
  const spacing = 40;
  nodes.forEach((n, i) => {
    nodeY[n] = i * spacing + 20;
  });
  const width = 200;
  const height = Math.max(...Object.values(nodeY)) + 40;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* edges */}
      {edges.map((e, i) => (
        <line
          key={i}
          x1={width / 2}
          y1={nodeY[e.from]}
          x2={width / 2}
          y2={nodeY[e.to]}
          stroke="#6ee7b7"
          strokeWidth={2}
        />
      ))}
      {/* nodes */}
      {nodes.map((n, i) => (
        <g key={i} transform={`translate(${width / 2},${nodeY[n]})`}> 
          <circle r={12} fill="#0ea5e9" />
          <text x={0} y={4} textAnchor="middle" fill="white" fontSize={10} fontFamily="sans-serif">
            {n}
          </text>
        </g>
      ))}
    </svg>
  );
}

