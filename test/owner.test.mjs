import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createEventBus } from '../node_modules/@earendil-works/pi-coding-agent/dist/core/event-bus.js';
import { installOwner } from '../dist/pi/owner.js';
import { connect } from 'pi-decision-tools';
import { temporaryFixture } from './helpers/fixtures.mjs';
const wrap=bus=>({events:{emit:(...args)=>bus.emit(...args),on:(...args)=>bus.on(...args)}});
const context=id=>({sessionManager:{getSessionId:()=>id}});
function runtime(id='s') {
  const calls=[];let enabled=true;
  return {calls,controls:{ledger:{sessionId:id},authorize(kind){if(!enabled)throw Object.assign(new Error('disabled'),{code:'disabled'});calls.push(['authorize',kind]);}},
    classifier:{async refresh(){calls.push(['refresh']);}},
    async submit(input,kind){calls.push(['submit',kind]);return {data:{ok:true,value:input}};},
    async continue(input,kind){calls.push(['continue',kind]);return {data:{ok:true,value:input}};},
    results(input){return {data:{ok:true,value:input}};},disable(){enabled=false;calls.push(['disable']);},
    async drain(){calls.push(['drain']);},clear(){calls.push(['clear']);},async expire(){enabled=false;calls.push(['expire']);}};
}

test('EX-06 physical library copies use actual Pi bus wrappers and exactly one owner',async t=>{
  const f=temporaryFixture(t),bus=createEventBus(),a=wrap(bus),b=wrap(bus);
  const owner=installOwner(a);assert.ok(owner);assert.equal(installOwner(b),undefined);
  const active=runtime();owner.attach(active);
  for(const name of ['copy-a','copy-b']){
    const dir=join(f.root,name);mkdirSync(dir);cpSync(new URL('../dist/',import.meta.url),join(dir,'dist'),{recursive:true});
    writeFileSync(join(dir,'package.json'),'{"type":"module"}');
    const library=await import(pathToFileURL(join(dir,'dist','index.js')).href);
    const client=library.connect(b,context('s'));assert.equal(client.protocol,1);
    await client.submit({fixture:name});
  }
  assert.equal(active.calls.filter(c=>c[0]==='submit').length,2);
  assert.ok(active.calls.filter(c=>c[0]==='submit').every(c=>c[1]==='library'));
  await owner.dispose();assert.throws(()=>connect(a,context('s')),{code:'coordinator_unavailable'});
});

test('EX-07 missing/incompatible owner fails without fallback registration',()=>{
  const bus=createEventBus(),host=wrap(bus);
  assert.throws(()=>connect(host,context('s')),{code:'coordinator_unavailable'});
  bus.on('pi-decision-tools:discover',q=>q.reply({protocol:2,ownerId:'newer',getClient(){throw new Error('unused');}}));
  assert.throws(()=>installOwner(host),{code:'coordinator_incompatible'});
  assert.throws(()=>connect(host,context('s')),{code:'coordinator_incompatible'});
});

test('EX-07 conflicting discovery replies immediately latch existing owner and stale facades closed',async()=>{
  const bus=createEventBus(),host=wrap(bus),owner=installOwner(host),active=runtime();owner.attach(active);
  const client=connect(host,context('s'));
  bus.on('pi-decision-tools:discover',q=>q.reply({protocol:1,ownerId:'rogue',getClient(){}}));
  assert.throws(()=>connect(host,context('s')),{code:'coordinator_conflict'});
  assert.ok(active.calls.some(c=>c[0]==='disable'));
  assert.equal((await client.submit({})).data.error.code,'coordinator_conflict');
  await owner.dispose();
});

test('EX-26 old facade expires after replacement even when the session ID is reused',async()=>{
  const bus=createEventBus(),host=wrap(bus),owner=installOwner(host);owner.attach(runtime());
  const old=connect(host,context('s'));await owner.retire();owner.attach(runtime());
  assert.equal((await old.submit({})).data.error.code,'runtime_expired');
  assert.equal(old.results({}).data.error.code,'runtime_expired');
  assert.equal((await connect(host,context('s')).submit({})).data.ok,true);
  assert.throws(()=>connect(host,context('different')),{code:'runtime_expired'});await owner.dispose();
});

test('EX-25 cancelled navigation pauses without clearing; successful navigation clears after drain',async()=>{
  const bus=createEventBus(),host=wrap(bus),owner=installOwner(host),active=runtime();owner.attach(active);
  await owner.pause();assert.deepEqual(active.calls,[['disable'],['drain']]);
  await owner.navigate();assert.deepEqual(active.calls.slice(-3),[['disable'],['drain'],['clear']]);await owner.dispose();await owner.dispose();
});
