// src/utils/contextLayer.ts

/**
 * Context Layer
 * Transforms raw signals into human‑readable context strings.
 */
import { Signal } from './signalLayer';

export function signalsToContext(signals: Signal[]): string[] {
  const context: string[] = [];
  for (const s of signals) {
    if (s.id === 'occupancy') {
      context.push(`occupancy = ${s.value}`);
    } else if (s.id.startsWith('motion_')) {
      const room = s.id.split('_')[1];
      context.push(`${room} motion = ${s.value ? 'active' : 'inactive'}`);
    } else if (s.id.startsWith('temp_')) {
      const room = s.id.split('_')[1];
      context.push(`${room} temperature = ${s.value}°C`);
    } else if (s.id.startsWith('humidity_')) {
      const room = s.id.split('_')[1];
      context.push(`${room} humidity = ${s.value}%`);
    } else if (s.id.startsWith('device_') && s.id.endsWith('_on')) {
      const dev = s.id.split('_')[1];
      context.push(`${dev} is ${s.value ? 'ON' : 'OFF'}`);
    } else if (s.id.startsWith('power_')) {
      const dev = s.id.split('_')[1];
      context.push(`${dev} power = ${s.value}W`);
    }
  }
  return context;
}

