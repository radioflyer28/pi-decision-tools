import test from 'node:test';
import assert from 'node:assert/strict';
import { FairScheduler, InvocationScope } from '../dist/core/scheduler.js';
import { deferred, FakeClock } from './helpers/fixtures.mjs';
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const clockAdapter=c=>({now:()=>c.now,setTimeout:c.setTimeout,clearTimeout:c.clearTimeout});

test('EX-09 round-robin batches share slots without a large batch monopolizing queue',async()=>{
  const scheduler=new FairScheduler(()=>2),order=[],gates=Array.from({length:6},()=>deferred());
  let next=0;
  const work=key=>scheduler.enqueue(key,async()=>{const index=next++;order.push(key);await gates[index].promise;return key;});
  const promises=[work('generic'),work('generic'),work('generic'),work('library'),work('semantic'),work('library')];
  await flush();assert.equal(scheduler.active,2);assert.deepEqual(order,['generic','library']);
  gates[0].resolve();await flush();assert.equal(scheduler.active,2);assert.deepEqual(order,['generic','library','semantic']);
  gates[1].resolve();await flush();assert.deepEqual(order,['generic','library','semantic','generic']);
  for(const gate of gates)gate.resolve();await Promise.all(promises);await flush();
  assert.equal(scheduler.active,0);assert.equal(scheduler.queued,0);
});

test('EX-20/21 aborted native promises retain slots until actual settlement',async()=>{
  const scheduler=new FairScheduler(()=>1),gate=deferred(),abort=new AbortController();let second=false;
  const a=scheduler.enqueue('a',()=>gate.promise,abort.signal);
  const b=scheduler.enqueue('b',async()=>{second=true;return 2;});
  await flush();abort.abort();await flush();assert.equal(second,false);assert.equal(scheduler.active,1);
  gate.resolve(1);assert.equal(await a,1);assert.equal(await b,2);await flush();assert.equal(scheduler.active,0);
});

test('EX-20 queued cancellation never runs the job or acquires a slot',async()=>{
  const scheduler=new FairScheduler(()=>1),gate=deferred(),abort=new AbortController();let calls=0;
  const a=scheduler.enqueue('a',()=>gate.promise);
  const b=scheduler.enqueue('b',async()=>{calls++;},abort.signal);
  const rejected=assert.rejects(b,{code:'cancelled'});
  await flush();abort.abort();await rejected;assert.equal(calls,0);assert.equal(scheduler.queued,0);
  gate.resolve();await a;
});

test('scheduler handles synchronous throws and reduced capacity without releasing occupied slots',async()=>{
  let capacity=2;const scheduler=new FairScheduler(()=>capacity),gate=deferred();
  const first=scheduler.enqueue('a',()=>gate.promise);
  const error=scheduler.enqueue('b',()=>{throw new Error('fixture');});
  await assert.rejects(error,/fixture/);await flush();capacity=1;let entered=false;
  const third=scheduler.enqueue('c',async()=>{entered=true;});await flush();assert.equal(entered,false);
  gate.resolve();await first;await third;assert.equal(entered,true);
});

test('EX-21 invocation deadline includes queue time and reports observed drain overrun',()=>{
  const c=new FakeClock(),scope=new InvocationScope(10,undefined,clockAdapter(c));
  c.advance(5);const attempt=scope.attempt(20);c.advance(5);
  assert.equal(scope.reason,'deadline');assert.equal(attempt.signal.aborted,true);
  c.advance(100);assert.equal(scope.elapsedMs,110);
  attempt.dispose();scope.dispose();assert.equal(c.timers.size,0);
});

test('EX-21 per-attempt deadline and caller cancellation remain distinct and clean up listeners',()=>{
  const c=new FakeClock(),caller=new AbortController(),scope=new InvocationScope(100,caller.signal,clockAdapter(c));
  const attempt=scope.attempt(5);c.advance(5);
  assert.equal(attempt.signal.aborted,true);assert.equal(scope.signal.aborted,false);
  caller.abort();assert.equal(scope.reason,'cancelled');scope.abort('disabled');assert.equal(scope.reason,'cancelled');
  attempt.dispose();scope.dispose();assert.equal(c.timers.size,0);
});
