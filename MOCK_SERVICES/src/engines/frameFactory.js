function buildFrame(simulationId, frameIndex, simTime, randomMode) {
  const randomOffset = randomMode ? Math.random() * 120 : 0;
  const passengerX = 1200 - frameIndex * 8 + randomOffset;
  const passengerY = -400 + (randomMode ? (Math.random() - 0.5) * 80 : 0);

  return {
    frameId: `${simulationId}_${String(frameIndex).padStart(6, '0')}`,
    simulationId,
    simTime,
    frameIndex,
    status: 'running',
    environment: {
      zones: [
        {
          zoneId: 'zone_platform_center',
          waterLevel: Math.min(1, 0.02 * frameIndex),
          waterFlowSpeed: 0.3,
          fireIntensity: Math.min(1, 0.015 * frameIndex),
          smokeType: 'toxicSmoke',
          smokeDensity: Math.min(1, 0.02 * frameIndex),
          gasConcentration: Math.min(1, 0.02 * frameIndex)
        }
      ]
    },
    agents: [
      {
        agentId: 'agent_0001',
        role: 'passenger',
        pos: [Number(passengerX.toFixed(2)), Number(passengerY.toFixed(2)), 10],
        yaw: 90,
        state: frameIndex > 12 ? 'running' : 'walking',
        health: Math.max(0, 100 - frameIndex),
        targetExit: 'exit_a',
        panicLevel: Math.min(1, 0.2 + frameIndex * 0.02)
      },
      {
        agentId: 'staff_fire_01',
        role: 'staffFire',
        pos: [780 + frameIndex * 3, -210, 10],
        yaw: 30,
        state: frameIndex > 8 ? 'extinguishing' : 'moving',
        health: 100,
        task: 'extinguish'
      }
    ],
    specialEntities: [
      {
        entityId: 'device_warning_01',
        entityType: 'warningLight',
        state: frameIndex >= 4 ? 'active' : 'inactive',
        runtime: {
          blink: true,
          effectRadius: 20,
          guideBoostProb: 0.12
        }
      }
    ],
    events: [],
    statistics: {
      totalEvacuated: Math.min(500, frameIndex * 6),
      inWaterDeep: Math.max(0, 30 - frameIndex),
      avgExposureTime: Number((simTime * 0.35).toFixed(2)),
      casualtyCount: frameIndex > 25 ? 1 : 0
    },
    ext: {}
  };
}

module.exports = {
  buildFrame
};
