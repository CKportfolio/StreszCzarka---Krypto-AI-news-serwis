const test = require('node:test');
const assert = require('node:assert/strict');
const { createApiKeyGuard, normalizeTableName, safeField } = require('../lib/security');

test('normalizeTableName maps API name to quoted application table name', () => {
  assert.equal(normalizeTableName('artykuly'), 'Artykuly');
  assert.equal(normalizeTableName('Archiwum'), 'Archiwum');
  assert.equal(normalizeTableName('_tmp1'), '_tmp1');
});

test('normalizeTableName rejects SQL-like identifiers', () => {
  for (const value of ['users;DROP TABLE users', 'bad-name', 'two words', '1table', '']) {
    assert.throws(() => normalizeTableName(value), /Invalid table name/);
  }
});

test('safeField accepts identifiers used as SQL columns', () => {
  assert.equal(safeField('data_powstania'), 'data_powstania');
  assert.equal(safeField('_internal2'), '_internal2');
});

test('safeField rejects unsafe column identifiers', () => {
  for (const value of ['field-name', 'field name', 'x";DROP TABLE', '1field', '']) {
    assert.throws(() => safeField(value), /Invalid field name/);
  }
});

test('API key guard fails closed if configuration is missing', () => {
  const guard = createApiKeyGuard('');
  const result = {};
  const res = {
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; }
  };
  let nextCalled = false;
  guard({ get: () => undefined }, res, () => { nextCalled = true; });
  assert.equal(result.status, 503);
  assert.equal(nextCalled, false);
});

test('API key guard rejects invalid key and accepts valid key', () => {
  const guard = createApiKeyGuard('internal-secret');
  const makeRes = result => ({
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; }
  });

  const rejected = {};
  let nextCalled = false;
  guard({ get: () => 'wrong' }, makeRes(rejected), () => { nextCalled = true; });
  assert.equal(rejected.status, 401);
  assert.equal(nextCalled, false);

  guard({ get: () => 'internal-secret' }, makeRes({}), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
