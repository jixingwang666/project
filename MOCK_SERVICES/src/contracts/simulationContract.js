const { isObject, isFiniteNumber, toFiniteNumber, ensureString } = require('./common');

function assertInitConfig(initConfig) {
  if (!isObject(initConfig)) {
    throw new Error('initConfig must be an object');
  }

  ensureString(initConfig.scenarioId, 'initConfig.scenarioId');
  ensureString(initConfig.mapLevel, 'initConfig.mapLevel');

  if (!isFiniteNumber(initConfig.totalPeople) || initConfig.totalPeople <= 0) {
    throw new Error('initConfig.totalPeople must be > 0');
  }
}

function normalizeRunRequest(body) {
  const source = isObject(body) ? body : {};
  const simulationId = ensureString(source.simulationId, 'simulationId');
  const initConfig = source.initConfig;
  const options = isObject(source.options) ? source.options : {};

  const fps = toFiniteNumber(options.fps, 2);
  const totalFrames = toFiniteNumber(options.totalFrames, 30);

  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error('options.fps must be > 0');
  }

  if (!Number.isFinite(totalFrames) || totalFrames <= 0 || !Number.isInteger(totalFrames)) {
    throw new Error('options.totalFrames must be a positive integer');
  }

  return {
    simulationId,
    initConfig,
    options: {
      fps,
      totalFrames,
      randomMode: Boolean(options.randomMode)
    }
  };
}

module.exports = {
  assertInitConfig,
  normalizeRunRequest
};
