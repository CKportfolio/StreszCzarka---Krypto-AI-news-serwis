import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const workflowDir = path.join(process.cwd(), 'workflows');
const files = readdirSync(workflowDir).filter(name => name.endsWith('.json')).sort();

function containsKey(value, key) {
  if (Array.isArray(value)) return value.some(item => containsKey(item, key));
  if (!value || typeof value !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(value, key)) return true;
  return Object.values(value).some(item => containsKey(item, key));
}

test('portfolio contains the four expected n8n workflows and every JSON parses', () => {
  assert.deepEqual(files, [
    '01-ingest-coindesk.json',
    '02-ingest-cointelegraph.json',
    '03-build-digest.json',
    '04-market-dashboard.json'
  ]);
  for (const file of files) {
    assert.doesNotThrow(() => JSON.parse(readFileSync(path.join(workflowDir, file), 'utf8')), file);
  }
});

test('exported workflows do not contain attached n8n credential objects', () => {
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(path.join(workflowDir, file), 'utf8'));
    assert.equal(containsKey(parsed, 'credentials'), false, `${file} contains credentials`);
  }
});

test('workflow service calls use environment configuration instead of a fixed VPS address', () => {
  const ingest1 = readFileSync(path.join(workflowDir, '01-ingest-coindesk.json'), 'utf8');
  const ingest2 = readFileSync(path.join(workflowDir, '02-ingest-cointelegraph.json'), 'utf8');
  const digest = readFileSync(path.join(workflowDir, '03-build-digest.json'), 'utf8');

  for (const content of [ingest1, ingest2]) {
    assert.match(content, /STRESZCZARKA_EXTRACTOR_URL/);
    assert.match(content, /STRESZCZARKA_STORAGE_API_URL/);
    assert.match(content, /STRESZCZARKA_INTERNAL_API_KEY/);
  }
  assert.match(digest, /STRESZCZARKA_STORAGE_API_URL/);
  assert.match(digest, /STRESZCZARKA_INTERNAL_API_KEY/);
});

test('portfolio workflows use the documented Mistral model', () => {
  const all = files.map(file => readFileSync(path.join(workflowDir, file), 'utf8')).join('\n');
  assert.match(all, /mistral-small-latest/);
});
