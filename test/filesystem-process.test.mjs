import test from 'node:test';
import assert from 'node:assert/strict';
import {readGitListing,gitListing,childEnvironment} from '../dist/filesystem/process.js';
import {temporaryFixture} from './helpers/fixtures.mjs';
const run=(script,signal,timeout)=>readGitListing(process.execPath,['--permission','--disable-warning=SecurityWarning','--input-type=module','-e',script],signal,timeout);

test('SM-16 bounded NUL parser preserves spaces/newlines and rejects malformed encoding/output',async()=>{
  assert.deepEqual(await run("process.stdout.write('a\\0space name\\0line\\nname\\0')"),{entries:['a','space name','line\nname'],complete:true});
  await assert.rejects(run("process.stdout.write(Buffer.from([255,0]))"),{code:'source_unverifiable'});
  await assert.rejects(run("process.stdout.write('unterminated')"),{code:'source_unverifiable'});
  await assert.rejects(run("process.stderr.write('PRIVATE_PROVIDER_DETAIL');process.exitCode=1"),{code:'source_unverifiable',message:'source_unverifiable'});
});

test('SM-23 parser bounds entry count, individual paths, aggregate bytes and stderr',async()=>{
  const entries=await run("process.stdout.write('a\\0'.repeat(10001))");assert.equal(entries.entries.length,10000);assert.equal(entries.complete,false);
  const path=await run("process.stdout.write('a'.repeat(4097)+'\\0')");assert.equal(path.entries.length,0);assert.equal(path.complete,false);
  const bytes=await run("process.stdout.write(('a'.repeat(4096)+'\\0').repeat(2100))");assert.equal(bytes.complete,false);assert.ok(bytes.entries.length<2100);
  await assert.rejects(run("process.stderr.write('x'.repeat(5000));setInterval(()=>{},1000)"),{code:'source_unverifiable'});
});

test('SM-23 bounded subprocess timeout/abort/spawn failure drain and sanitize',async t=>{
  const f=temporaryFixture(t);
  await assert.rejects(gitListing(f.root,undefined,'definitely-missing-git-executable'),{code:'git_required'});
  await assert.rejects(run('setInterval(()=>{},1000)',undefined,20),{code:'source_unverifiable'});
  await assert.rejects(run('setInterval(()=>{},1000)',AbortSignal.abort()),{code:'cancelled'});
  assert.equal(childEnvironment().OPENAI_API_KEY,undefined);assert.equal(childEnvironment().GIT_WORK_TREE,undefined);
});
