import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createApiKeyGuard,
  isAllowedBrowserRequest,
  isAllowedHost,
  parseAllowedHosts,
  validateTargetUrl
} from '../lib/security.js';

test('parseAllowedHosts normalizes configured hosts', () => {
  assert.deepEqual(parseAllowedHosts(' CoinDesk.com, api.example.com ,, '), ['coindesk.com', 'api.example.com']);
});

test('host allowlist accepts exact host and subdomains', () => {
  const allowed = ['coindesk.com'];
  assert.equal(isAllowedHost('coindesk.com', allowed), true);
  assert.equal(isAllowedHost('www.coindesk.com', allowed), true);
});

test('host allowlist rejects lookalike domains', () => {
  const allowed = ['coindesk.com'];
  assert.equal(isAllowedHost('coindesk.com.evil.example', allowed), false);
  assert.equal(isAllowedHost('notcoindesk.com', allowed), false);
});

test('URL validation accepts only http/https on allowlisted hosts', () => {
  const allowed = ['cointelegraph.com'];
  assert.equal(validateTargetUrl('https://cointelegraph.com/news/test', allowed).ok, true);
  assert.equal(validateTargetUrl('ftp://cointelegraph.com/file', allowed).status, 400);
  assert.equal(validateTargetUrl('https://example.com/', allowed).status, 403);
  assert.equal(validateTargetUrl('not-a-url', allowed).status, 400);
});

test('browser request policy re-checks redirects and subrequests', () => {
  const allowed = ['coindesk.com'];
  assert.equal(isAllowedBrowserRequest('https://www.coindesk.com/article', allowed), true);
  assert.equal(isAllowedBrowserRequest('https://127.0.0.1/admin', allowed), false);
  assert.equal(isAllowedBrowserRequest('http://169.254.169.254/latest/meta-data', allowed), false);
  assert.equal(isAllowedBrowserRequest('data:text/plain,ok', allowed), true);
});

test('API key guard fails closed when key is not configured', () => {
  const guard = createApiKeyGuard('');
  const result = {};
  const req = { get: () => undefined };
  const res = {
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; }
  };
  let nextCalled = false;
  guard(req, res, () => { nextCalled = true; });
  assert.equal(result.status, 503);
  assert.equal(nextCalled, false);
});

test('API key guard rejects wrong key and accepts correct key', () => {
  const guard = createApiKeyGuard('secret');
  const makeRes = result => ({
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; }
  });

  let nextCalled = false;
  const rejected = {};
  guard({ get: () => 'wrong' }, makeRes(rejected), () => { nextCalled = true; });
  assert.equal(rejected.status, 401);
  assert.equal(nextCalled, false);

  guard({ get: () => 'secret' }, makeRes({}), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
