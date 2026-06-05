const { isObject, isFiniteNumber, ensureString } = require('./common');

function normalizePlanRequest(body) {
  const source = isObject(body) ? body : {};
  const fromSimulationId = ensureString(source.fromSimulationId, 'fromSimulationId');
  const fromSimTime = Number(source.fromSimTime);

  if (!isFiniteNumber(fromSimTime) || fromSimTime < 0) {
    throw new Error('fromSimTime must be a non-negative number');
  }

  return {
    fromSimulationId,
    fromSimTime,
    objective: String(source.objective || 'Improve evacuation and reduce exposure'),
    context: isObject(source.context) ? source.context : {},
    initConfigLike: isObject(source.initConfigLike) ? source.initConfigLike : {}
  };
}

module.exports = {
  normalizePlanRequest
};
