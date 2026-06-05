const { buildFrame } = require('./frameFactory');

function createMockSimulationEngine(options = {}) {
  const defaultFps = Number(options.defaultFps || 2);
  const defaultTotalFrames = Number(options.defaultTotalFrames || 30);

  return {
    async runSimulation(input, sinks) {
      const fps = Number(input.options.fps || defaultFps);
      const totalFrames = Number(input.options.totalFrames || defaultTotalFrames);
      const randomMode = Boolean(input.options.randomMode);
      const intervalMs = Math.max(50, Math.floor(1000 / Math.max(1, fps)));

      if (!sinks || typeof sinks.onFrame !== 'function') {
        throw new Error('onFrame sink is required');
      }

      let frameIndex = 0;
      const timer = setInterval(async () => {
        try {
          if (frameIndex >= totalFrames) {
            clearInterval(timer);
            if (sinks.onCompleted) {
              sinks.onCompleted({ simulationId: input.simulationId, totalFrames });
            }
            return;
          }

          const simTime = Number((frameIndex / fps).toFixed(3));
          const frame = buildFrame(input.simulationId, frameIndex, simTime, randomMode);
          if (frameIndex === totalFrames - 1) {
            frame.status = 'completed';
            frame.events = [
              {
                type: 'simulation_completed',
                simTime,
                frameIndex
              }
            ];
          }

          await sinks.onFrame(frame);
          frameIndex += 1;
        } catch (error) {
          clearInterval(timer);
          if (sinks.onError) {
            sinks.onError(error);
          }
        }
      }, intervalMs);

      return {
        status: 'accepted',
        simulationId: input.simulationId,
        fps,
        totalFrames,
        intervalMs,
        randomMode
      };
    }
  };
}

module.exports = {
  createMockSimulationEngine
};
