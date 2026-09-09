// src/utils/correlationLayer.ts

/**
 * Correlation Layer
 * Combines multiple signals into a correlation description.
 * For simplicity, it creates a list of relation strings.
 */
import { Signal } from './signalLayer';

export interface Correlation {
  description: string;
  // optional edges for graph rendering
  edges?: { from: string; to: string }[];
}

export function buildCorrelation(signals: Signal[]): Correlation {
  // Very lightweight heuristic: if occupancy=0 and any device is ON, we consider them correlated.
  const occup = signals.find(s => s.id === 'occupancy');
  const activeDevices = signals.filter(s => s.id.startsWith('device_') && s.id.endsWith('_on') && s.value === 1);
  const descriptionParts: string[] = [];
  const edges: { from: string; to: string }[] = [];

  if (occup && occup.value === 0) {
    descriptionParts.push('Home appears unoccupied');
    // link occupancy to each device
    activeDevices.forEach(d => {
      const dev = d.id.split('_')[1];
      edges.push({ from: 'occupancy', to: dev });
    });
  }

  if (activeDevices.length) {
    const deviceNames = activeDevices.map(d => d.id.split('_')[1]).join(', ');
    descriptionParts.push(`${deviceNames} still active`);
  }

  const description = descriptionParts.join(' while ');
  return { description: description || 'No notable correlation', edges };
}

