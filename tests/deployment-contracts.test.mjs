import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const compose = readFileSync('docker-compose.yml', 'utf8');
const envExample = readFileSync('.env.example', 'utf8');

test('Docker Compose exposes internal APIs on loopback only', () => {
  assert.match(compose, /127\.0\.0\.1:\$\{STORAGE_API_PORT:-8900\}:8900/);
  assert.match(compose, /127\.0\.0\.1:\$\{EXTRACTOR_PORT:-10420\}:10420/);
});

test('both internal services receive the API key from environment', () => {
  const matches = compose.match(/INTERNAL_API_KEY:\s*\$\{INTERNAL_API_KEY\}/g) || [];
  assert.equal(matches.length, 2);
});

test('.env.example documents required local configuration without a real secret', () => {
  assert.match(envExample, /^DB_PASSWORD=/m);
  assert.match(envExample, /^INTERNAL_API_KEY=/m);
  assert.doesNotMatch(envExample, /eyJ[A-Za-z0-9_-]{20,}\./);
});
