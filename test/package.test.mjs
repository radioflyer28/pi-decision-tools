import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test('package exposes library and extension with declarations and unbundled host peers', async () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.private, true);
  assert.deepEqual(pkg.pi.extensions, ['./dist/extension.js']);
  for (const entry of Object.values(pkg.exports)) {
    assert.ok(readFileSync(new URL('../' + entry.types, import.meta.url), 'utf8').length);
    assert.ok(readFileSync(new URL('../' + entry.import, import.meta.url), 'utf8').length);
  }
  assert.equal((await import('pi-decision-tools')).protocolVersion, 1);
  assert.equal(typeof (await import('pi-decision-tools/extension')).default, 'function');
  for (const peer of ['@earendil-works/pi-ai', '@earendil-works/pi-coding-agent', 'typebox']) {
    assert.equal(pkg.peerDependencies[peer], '*');
    assert.equal(pkg.dependencies?.[peer], undefined);
  }
  assert.ok(!readdirSync(new URL('../dist/', import.meta.url)).includes('node_modules'));
});

test('library imports without opening resources or producing output', () => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e',
    "await import('pi-decision-tools'); if (process.getActiveResourcesInfo().some(x => !['PipeWrap','TTYWrap'].includes(x))) process.exit(2);"
  ], { cwd: new URL('../', import.meta.url), timeout: 5000, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, '');
  assert.equal(child.stderr, '');
});
