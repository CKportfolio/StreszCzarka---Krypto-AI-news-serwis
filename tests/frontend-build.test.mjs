import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('frontend build injects public Supabase configuration and removes placeholders', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'streszczarka-frontend-'));
  try {
    cpSync(path.join(process.cwd(), 'frontend', 'index.template.html'), path.join(temp, 'index.template.html'));
    cpSync(path.join(process.cwd(), 'frontend', 'replace-env.js'), path.join(temp, 'replace-env.js'));

    const result = spawnSync(process.execPath, ['replace-env.js'], {
      cwd: temp,
      encoding: 'utf8',
      env: {
        ...process.env,
        SUPABASE_URL: 'https://portfolio-test.supabase.co',
        SUPABASE_ANON_KEY: 'public-test-anon-key'
      }
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const html = readFileSync(path.join(temp, 'index.html'), 'utf8');
    assert.match(html, /https:\/\/portfolio-test\.supabase\.co/);
    assert.match(html, /public-test-anon-key/);
    assert.doesNotMatch(html, /__SUPABASE_URL__|__SUPABASE_ANON_KEY__/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
