function createMockPlanEngine() {
  return {
    buildPlan(input) {
      const triggerAt = Number((input.fromSimTime + 2).toFixed(1));

      return {
        planConfig: {
          planId: `plan_mock_${Date.now()}`,
          fromSimulationId: input.fromSimulationId,
          fromSimTime: input.fromSimTime,
          planSource: 'llm',
          objective: input.objective,
          initConfigLike: {
            scenarioId: 'metro_fire_water_01',
            mapLevel: 'Station_A_Platform',
            totalPeople: 500,
            disasters: {
              water: {
                enabled: true,
                inlets: [
                  {
                    inletId: 'water_inlet_01',
                    zoneId: 'zone_entrance_02',
                    position: [1200, -500, 20],
                    inflowRate: 50,
                    totalVolume: 12000,
                    startAt: 0,
                    duration: 240
                  }
                ]
              },
              fire: {
                enabled: true,
                sources: [
                  {
                    fireId: 'fire_src_01',
                    position: [1080, -460, 100],
                    spreadSpeed: 1.2,
                    fireType: 'electric',
                    gasType: 'toxicSmoke',
                    gasSpreadSpeed: 1.8,
                    initialConcentration: 0.35,
                    startAt: 0
                  }
                ]
              }
            },
            specialEntities: [
              {
                entityId: 'staff_fire_01',
                entityType: 'staffFire',
                position: [780, -210, 10],
                triggerAt,
                config: {
                  moveTarget: [1080, -460, 10],
                  onArriveAction: 'extinguish',
                  fireSpreadReduce: 0.3,
                  gasSpreadReduce: 0.25
                }
              }
            ]
          },
          planRuntime: {
            actions: [
              {
                actionId: 'act_mock_01',
                startAt: triggerAt,
                targetId: 'device_warning_01',
                action: 'setBlink',
                params: {
                  blink: true,
                  guideBoostProb: 0.2
                }
              }
            ]
          },
          expectedMetrics: {
            evacuationRateImprove: 0.12,
            avgExposureTimeReduce: 0.18
          },
          ext: {
            generatedBy: 'mock-llm'
          }
        }
      };
    }
  };
}

module.exports = {
  createMockPlanEngine
};
