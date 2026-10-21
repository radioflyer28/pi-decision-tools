// Run with an already installed Linux Node runtime; no package installation or network access.
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
assert.notEqual(process.platform,'win32','This runner requires actual POSIX filesystem semantics');
const root=fileURLToPath(new URL('../',import.meta.url)),temporary=mkdtempSync(join(tmpdir(),'pi-filesystem-posix-'));
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|TMPDIR|LANG)$/.test(key)));
Object.assign(env,{HOME:temporary,USERPROFILE:temporary,TEST_TEMP_ROOT:temporary,PI_CODING_AGENT_DIR:temporary,
  NODE_OPTIONS:`--permission --allow-fs-read="${resolve(root)}" --allow-fs-read="${temporary}" --allow-fs-write="${temporary}" --allow-child-process --disable-warning=SecurityWarning --import="${new URL('../test/helpers/offline.mjs',import.meta.url).href}"`});
const gitMetadata=[];for(let directory=dirname(temporary);;directory=dirname(directory)){
  gitMetadata.push(`--allow-fs-read=${join(directory,'.git')}`);if(directory===dirname(directory))break;
}
try{
  let count=0;
  for(const file of readdirSync(join(root,'test')).filter(name=>name.startsWith(process.argv[2]??'filesystem-')&&name.endsWith('.test.mjs')).sort()){
    const r=spawnSync(process.execPath,[...gitMetadata,'--test-reporter=spec',join(root,'test',file)],{cwd:root,env,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
    assert.equal(r.status,0,`${file}\n${r.error??''}\n${r.stdout}\n${r.stderr}`);
    const tests=Number(r.stdout.match(/ℹ tests (\d+)/)?.[1]??0),passed=Number(r.stdout.match(/ℹ pass (\d+)/)?.[1]??0);
    assert.ok(tests>0);assert.equal(passed,tests);assert.match(r.stdout,/ℹ skipped 0/);count+=tests;
    console.log(`${file}: ${passed}/${tests} passed on ${process.platform}`);
  }
  assert.ok(count>0,'No POSIX tests selected');
  console.log(`POSIX filesystem verification: ${count} tests passed; ${process.version}; no live calls`);
}finally{rmSync(temporary,{recursive:true,force:true});}
