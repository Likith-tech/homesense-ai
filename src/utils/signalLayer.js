// src/utils/signalLayer.js

/**
 * Signal Layer - extracts raw telemetry values from the simulator state.
 */
export function getSignals(state) {
  const signals = [];
  const { sensors, devices, energy } = state;
  // occupancy derived from any motion
  const occupancy = Object.values(sensors.rooms).some(r => r.motion) ? 1 : 0;
  signals.push({ id: 'occupancy', value: occupancy });
  // per-room signals
  Object.entries(sensors.rooms).forEach(([roomId, room]) => {
    signals.push({ id: `motion_${roomId}`, value: room.motion ? 1 : 0 });
    signals.push({ id: `temp_${roomId}`, value: room.temp });
    signals.push({ id: `humidity_${roomId}`, value: room.humidity });
  });
  // device state signals
  Object.entries(devices).forEach(([devId, dev]) => {
    signals.push({ id: `device_${devId}_on`, value: dev.on ? 1 : 0 });
    if (dev.setpoint !== undefined) signals.push({ id: `device_${devId}_setpoint`, value: dev.setpoint });
  });
  // power snapshot signals
  if (energy?.snapshot?.byDevice) {
    Object.entries(energy.snapshot.byDevice).forEach(([devId, w]) => {
      signals.push({ id: `power_${devId}`, value: w });
    });
  }
  signals.push({ id: 'totalPower', value: energy?.total || 0 });
  signals.push({ id: 'simTime', value: state.simTime });
  return signals;
}

