function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function toFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ensureString(value, fieldName) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

module.exports = {
  isObject,
  isFiniteNumber,
  toFiniteNumber,
  ensureString
};
