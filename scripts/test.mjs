import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Dedicated child environment: never inherit provider credentials or user configuration.
const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'pi-decision-tests-'));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(path|systemroot|windir|temp|tmp|comspec|pathext|number_of_processors)$/i.test(key)));
Object.assign(env, {
  HOME: temporary, USERPROFILE: temporary, PI_CODING_AGENT_DIR: temporary,
  TEST_TEMP_ROOT: temporary, TEST_FORBIDDEN_PATH: join(homedir(), '.pi', 'agent', 'auth.json'),
  NODE_OPTIONS: ['--permission', `--allow-fs-read="${resolve(root).replaceAll('\\', '/')}"`,
    `--allow-fs-read="${temporary.replaceAll('\\', '/')}"`, `--allow-fs-write="${temporary.replaceAll('\\', '/')}"`,
    '--allow-child-process', '--disable-warning=SecurityWarning',
    `--import="${new URL('../test/helpers/offline.mjs', import.meta.url).href}"`].join(' '),
});
// Permit only ancestor .git metadata paths, not ancestor directories or private file contents.
const gitMetadata=[];for(let directory=dirname(temporary);;directory=dirname(directory)){
  gitMetadata.push(`--allow-fs-read=${join(directory,'.git').replaceAll('\\','/')}`);
  if(directory===dirname(directory))break;
}
try {
  const files = readdirSync(join(root, 'test')).filter(name => name.endsWith('.test.mjs') && name.startsWith(process.argv[2] ?? ''));
  if (!files.length) throw new Error('No test files found');
  // Node 24 Windows --test discovery fails under scoped FS permissions, even for
  // explicit paths. Direct file execution still runs node:test with exit status.
  let total = 0;
  for (const file of files.sort()) {
    const result = spawnSync(process.execPath, [...((file.startsWith('filesystem-')||file==='semantic-host-integration.test.mjs')?gitMetadata:[]), '--test-reporter=spec', join(root, 'test', file)], {
      cwd: root, env: file === 'semantic-host-integration.test.mjs'
        ? { ...env, NODE_OPTIONS: `${env.NODE_OPTIONS} --allow-worker` } : env,
      encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    const count = Number(result.stdout.match(/ℹ tests (\d+)/)?.[1] ?? 0);
    const passed = Number(result.stdout.match(/ℹ pass (\d+)/)?.[1] ?? 0);
    if (result.status !== 0 || count === 0 || passed !== count) {
      console.error(result.stdout, result.stderr);
      process.exitCode = result.status || 1;
    } else {
      console.log(`${file}: ${passed}/${count} passed`);
      if(process.argv[3]==='--details')console.log(result.stdout);
    }
    total += count;
  }
  console.log(`Total: ${total} tests in ${files.length} files; ${process.exitCode ? 'FAILED' : 'passed'}`);
} finally { rmSync(temporary, { recursive: true, force: true }); }
