import { readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const excluded = new Set(['node_modules', '.git']);
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (excluded.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (entry.endsWith('.js') || entry.endsWith('.mjs')) files.push(full);
  }
}

walk(root);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}
console.log(`Syntax OK: ${files.length} JavaScript files checked.`);
