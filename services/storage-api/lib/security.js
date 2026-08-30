function createApiKeyGuard(expectedKey) {
  return function requireApiKey(req, res, next) {
    if (!expectedKey) {
      return res.status(503).json({ error: 'Internal API authentication is not configured' });
    }
    if (req.get('x-api-key') !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
  };
}

function normalizeTableName(name) {
  const safe = String(name || '');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(safe)) throw new Error('Invalid table name');
  return safe.charAt(0).toUpperCase() + safe.slice(1);
}

function safeField(name) {
  const safe = String(name || '');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(safe)) throw new Error('Invalid field name');
  return safe;
}

module.exports = { createApiKeyGuard, normalizeTableName, safeField };
