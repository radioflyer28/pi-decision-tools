import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { request } from 'node:https';
import { deferred, FakeClock, FakeClassifier, temporaryFixture, fakeSession } from './helpers/fixtures.mjs';

test('default test process cannot read user auth or send provider traffic', async () => {
  assert.ok(process.permission);
  assert.equal(process.permission.has('fs.read',process.env.TEST_FORBIDDEN_PATH),false);
  assert.throws(() => readFileSync(process.env.TEST_FORBIDDEN_PATH),{code:'ERR_ACCESS_DENIED'});
  assert.equal(process.env.OPENAI_API_KEY,undefined);
  assert.equal(process.env.ANTHROPIC_API_KEY,undefined);
  assert.equal(process.env.HOME,process.env.TEST_TEMP_ROOT);
  assert.equal(process.env.PI_CODING_AGENT_DIR,process.env.TEST_TEMP_ROOT);
  await assert.rejects(fetch('https://example.invalid'),{code:'TEST_NETWORK_FORBIDDEN'});
  assert.throws(() => connect(443,'example.invalid'),{code:'TEST_NETWORK_FORBIDDEN'});
  assert.throws(() => request('https://example.invalid'),{code:'TEST_NETWORK_FORBIDDEN'});
});

test('temporary configuration/session fixtures are isolated and permit local writes', t => {
  const a=temporaryFixture(t), b=temporaryFixture(t);
  assert.notEqual(a.root,b.root);
  writeFileSync(a.configPath,'{"version":1}');
  assert.equal(readFileSync(a.configPath,'utf8'),'{"version":1}');
  const session=fakeSession(); session.append('fixture',{n:1});
  const copy=session.getEntries(); copy[0].data.n=2;
  assert.equal(session.getEntries()[0].data.n,1);
});

test('fake clock deterministically fires ordered timers and cancellation', () => {
  const clock=new FakeClock(), calls=[];
  clock.setTimeout(() => calls.push(clock.now),10);
  const cancelled=clock.setTimeout(() => calls.push('cancelled'),2);
  clock.clearTimeout(cancelled);
  clock.setTimeout(() => calls.push(clock.now),5);
  clock.advance(10); assert.deepEqual(calls,[5,10]);
  assert.equal(clock.timers.size,0);
  assert.throws(() => clock.advance(-1));
});

test('instrumented classifier exposes abort-ignoring overlap and drains only on settlement', async () => {
  const gate=deferred(), controller=new AbortController();
  const fake=new FakeClassifier(() => gate.promise);
  const request={state:{text:'synthetic'},questions:{q:{type:'bool',instructions:'fixture',criteria:{true:'yes',false:'no'}}}};
  const pending=fake.classify({provider:'fake',id:'fixture'},request,{signal:controller.signal});
  controller.abort(); assert.equal(fake.active,1); assert.equal(fake.calls[0].aborted,true);
  const other=await fake.classify({provider:'fake',id:'fixture'},request);
  assert.equal(fake.peak,2); assert.equal(other.answers.q.probability,0.75);
  gate.resolve(other); await pending; assert.equal(fake.active,0);
});
