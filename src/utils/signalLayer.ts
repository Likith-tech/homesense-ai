// src/utils/signalLayer.ts

/**
 * Signal Layer
 * Extracts raw telemetry values from the simulator state.
 */
export interface Signal {
  id: string;
  value: any;
}

export function getSignals(state: any): Signal[] {
  const signals: Signal[] = [];
  const { sensors, devices, energy } = state;

  // Example raw signals
  signals.push({ id: 'occupancy', value: Object.values(sensors.rooms).some((r: any) => r.motion) ? 1 : 0 });
  Object.entries(sensors.rooms).forEach(([roomId, room]) => {
    signals.push({ id: `motion_${roomId}`, value: room.motion ? 1 : 0 });
    signals.push({ id: `temp_${roomId}`, value: room.temp });
    signals.push({ id: `humidity_${roomId}`, value: room.humidity });
  });
  Object.entries(devices).forEach(([devId, dev]) => {
    signals.push({ id: `device_${devId}_on`, value: dev.on ? 1 : 0 });
    if (dev.setpoint !== undefined) signals.push({ id: `device_${devId}_setpoint`, value: dev.setpoint });
  });
  if (energy?.snapshot?.byDevice) {
    Object.entries(energy.snapshot.byDevice).forEach(([devId, w]) => {
      signals.push({ id: `power_${devId}`, value: w });
    });
  }
  signals.push({ id: 'totalPower', value: energy?.total || 0 });
  signals.push({ id: 'simTime', value: state.simTime });
  return signals;
}

