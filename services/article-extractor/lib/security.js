export const DEFAULT_ALLOWED_HOSTS = [
  'coindesk.com',
  'cointelegraph.com',
  'tradingeconomics.com',
  'google.com'
];

export function parseAllowedHosts(value) {
  if (!value) return [...DEFAULT_ALLOWED_HOSTS];
  return String(value)
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedHost(hostname, allowedHosts = DEFAULT_ALLOWED_HOSTS) {
  const host = String(hostname || '').trim().toLowerCase();
  return allowedHosts.some(allowed => host === allowed || host.endsWith(`.${allowed}`));
}

export function validateTargetUrl(value, allowedHosts = DEFAULT_ALLOWED_HOSTS) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, status: 400, error: 'Invalid URL' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, status: 400, error: 'Only http/https URLs are allowed' };
  }

  if (!isAllowedHost(parsed.hostname, allowedHosts)) {
    return { ok: false, status: 403, error: `Host not allowed: ${parsed.hostname}` };
  }

  return { ok: true, url: parsed };
}

export function isAllowedBrowserRequest(value, allowedHosts = DEFAULT_ALLOWED_HOSTS) {
  if (typeof value !== 'string') return false;
  if (value.startsWith('data:') || value.startsWith('blob:')) return true;
  return validateTargetUrl(value, allowedHosts).ok;
}

export function createApiKeyGuard(expectedKey) {
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
