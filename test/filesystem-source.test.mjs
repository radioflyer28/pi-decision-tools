import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync,symlinkSync,unlinkSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const makeLink=(target,path,type)=>{
  // Node requires unrestricted fs permission for symlink creation even inside allowed directories.
  // Only this fixed fixture helper gets broad fs flags; it validates both paths under TEST_TEMP_ROOT.
  const r=spawnSync(process.execPath,['--permission','--allow-fs-read=*','--allow-fs-write=*','--disable-warning=SecurityWarning',fileURLToPath(new URL('./helpers/filesystem-link.mjs',import.meta.url)),target,path,type],
    {env:{...process.env,NODE_OPTIONS:`--import="${new URL('./helpers/offline.mjs',import.meta.url).href}"`},encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
};
import {SafeSource,sourceReason} from '../dist/filesystem/source.js';
import {WindowsAttributes} from '../dist/filesystem/process.js';
import {temporaryFixture} from './helpers/fixtures.mjs';
const sourceFor=(t,root,hooks)=>{const s=new SafeSource(root,hooks);t.after(()=>s.close());return s;};

test('SM-18 actual root/intermediate/final links and Windows junctions refuse outside bytes',async t=>{
  const f=temporaryFixture(t),outside=temporaryFixture(t);writeFileSync(join(outside.root,'marker'),'PRIVATE_OUTSIDE');
  makeLink(outside.root,join(f.root,'escape'),process.platform==='win32'?'junction':'dir');
  const s=sourceFor(t,f.root);await assert.rejects(s.inspect('escape/marker'),{code:'link'});
  const linkedRoot=sourceFor(t,join(f.root,'escape'));await assert.rejects(linkedRoot.verifyRoot(),{code:'link'});
  if(process.platform!=='win32'){
    makeLink(join(outside.root,'marker'),join(f.root,'file-link'),'file');
    await assert.rejects(s.inspect('file-link'),{code:'link'});
  }
  await assert.rejects(s.inspect('../marker'),{code:'outside_root'});
});

test('SM-18 platform attributes are verified and fail closed on inability',async t=>{
  const f=temporaryFixture(t);writeFileSync(join(f.root,'a'),'safe');
  const s=sourceFor(t,f.root,{attributes:async()=>{throw Error('PRIVATE_HELPER');}});
  await assert.rejects(s.inspect('a'));assert.equal(sourceReason(Error('PRIVATE_HELPER')),'unverifiable');
  if(process.platform==='win32'){
    const worker=new WindowsAttributes(1);t.after(()=>worker.close());
    await assert.rejects(worker.query([f.root]),{code:'unverifiable'});
    await assert.rejects(worker.query([f.root]),{code:'unverifiable'});
  }
});

test('SM-24 actual stable descriptor capture and capture-time mutation',async t=>{
  const f=temporaryFixture(t),path=join(f.root,'a');writeFileSync(path,'original');
  const stable=sourceFor(t,f.root);const captured=await stable.capture(await stable.inspect('a'));
  assert.equal(captured.bytes.toString(),'original');assert.equal(captured.fileHash.length,64);
  const changed=sourceFor(t,f.root,{afterRead:async()=>writeFileSync(path,'changed and longer')});
  await assert.rejects(changed.capture(await changed.inspect('a')),{code:'changed'});
  const replaced=sourceFor(t,f.root,{beforeOpen:async()=>{renameSync(path,path+'.old');writeFileSync(path,'replacement');}});
  await assert.rejects(replaced.capture(await replaced.inspect('a')),{code:'changed'});
  // Handles were closed: deletion/replacement is possible after both failure paths.
  unlinkSync(path);writeFileSync(path,'again');assert.equal((await stable.capture(await stable.inspect('a'))).bytes.toString(),'again');
});

test('SM-24 capture cancellation, size, nonregular and stable sanitized reasons',async t=>{
  const f=temporaryFixture(t);writeFileSync(join(f.root,'a'),'text');mkdirSync(join(f.root,'directory'));
  writeFileSync(join(f.root,'large'),Buffer.alloc(1048577));const s=sourceFor(t,f.root);
  await assert.rejects(s.capture(await s.inspect('a'),AbortSignal.abort()),{code:'cancelled'});
  await assert.rejects(s.capture(await s.inspect('directory')),{code:'nonregular'});
  await assert.rejects(s.capture(await s.inspect('large')),{code:'file_too_large'});
  for(const [code,expected] of [['ENOENT','missing'],['EACCES','unreadable'],['EPERM','unreadable'],['PRIVATE','unverifiable']])
    assert.equal(sourceReason(Object.assign(Error('PRIVATE'),{code})),expected);
});
