import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {SessionManager} from '../node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js';
import {Coordinator} from '../dist/core/coordinator.js';
import {ExecutionControls} from '../dist/core/controls.js';
import {ClassifierAdapter} from '../dist/pi/classifier-adapter.js';
import {SessionLedger} from '../dist/pi/session-adapter.js';
import {DEFAULT_LIMITS,jsonBytes} from '../dist/core/validation.js';
import {SemanticExecution} from '../dist/semantic/execution.js';
import {FileEvidenceCapturer} from '../dist/filesystem/capture.js';
import {temporaryFixture,fakeUsage} from './helpers/fixtures.mjs';

test('SM-23 capture uses actual generic and record coordinator pool without calls or liability mutation',async t=>{
  const f=temporaryFixture(t),session=SessionManager.create(f.root,f.sessions);
  session.appendMessage({role:'user',content:'Synthetic shared-resource test',timestamp:0});
  const ledger=new SessionLedger(session,(type,data)=>session.appendCustomEntry(type,data));let calls=0;
  const model={type:'classifier',provider:'fake',id:'fixture',name:'Fixture',api:'fake',baseUrl:'https://fixture.invalid',input:['text'],contextWindow:10000,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
  const adapter=new ClassifierAdapter({getAvailableOfType:async()=>[model],classify:async()=>{calls++;return {api:'fake',provider:'fake',model:'fixture',stopReason:'stop',timestamp:0,usage:fakeUsage(),answers:{q:{type:'bool',probability:0.8}}};}});
  await adapter.refresh();const controls=new ExecutionControls(ledger,adapter.available,{version:1,families:{generic:true,semantic:true},limits:{...DEFAULT_LIMITS}});
  const core=new Coordinator(controls,adapter);controls.enable();t.after(()=>core.expire());
  const generic=await core.submit({items:[{id:'g',inputVersion:'1',state:{text:'generic'}}],rubricVersion:'1',questions:{q:{type:'bool',instructions:'Fixture?',criteria:{true:'yes',false:'no'}}},run:{}},'generic');
  assert.equal(generic.data.ok,true);assert.equal(calls,1);assert.equal(ledger.snapshot().totals.chargedRequests,1);
  const semantic=new SemanticExecution(core),parent=await semantic.filter({records:[{id:'r',text:'record'}],predicate:'Fixture?'});
  const beforeLedger=ledger.snapshot(),beforeEntries=session.getEntries(),beforeRetained=core.memory.retainedBytes,beforeReserved=core.memory.reservedBytes;
  writeFileSync(join(f.root,'a'),'hello');writeFileSync(join(f.root,'b'),Buffer.alloc(200000,97));
  const capturer=new FileEvidenceCapturer(f.root,core.memory),scope=await capturer.capture({paths:['a']});t.after(()=>scope.release());
  const summary=scope.summary(),e=scope.evidence()[0];assert.equal(scope.state,undefined);
  const expected=jsonBytes({summary,files:[{path:'a',fileHash:e.fileHash}],windows:[{file:0,range:{startLine:1,endLine:1,startByte:0,endByte:5,textHash:e.textHash},evidence:e}],scope:{paths:['a']},userExclusions:[],candidates:['a']},Number.MAX_SAFE_INTEGER)+5;
  assert.equal(core.memory.retainedBytes-beforeRetained,expected);assert.equal(core.memory.reservedBytes,beforeReserved);
  assert.equal(await scope.freshness(e.evidenceId),'unchanged');scope.release();scope.release();
  assert.equal(core.memory.retainedBytes,beforeRetained);assert.equal(core.memory.reservedBytes,beforeReserved);
  assert.equal(Object.hasOwn(scope,'state'),false);assert.throws(()=>scope.summary(),{code:'search_expired'});
  const pressure=core.memory.allocate(core.memory.availableBytes-12000);
  const partial=await capturer.capture({paths:['a','b']});assert.equal(partial.summary().stopReason,'workspace_full');assert.deepEqual(partial.evidence().map(x=>x.path),['a']);partial.release();core.memory.release(pressure);
  await assert.rejects(capturer.capture({paths:['a','../outside']}),{code:'scope_invalid'});
  assert.equal(core.memory.retainedBytes,beforeRetained);assert.equal(core.memory.reservedBytes,beforeReserved);
  assert.equal(core.results({batchId:generic.data.value.batchId}).data.ok,true);assert.equal(semantic.parents.get(parent.operationId).prepared.records[0].text,'record');
  assert.deepEqual(ledger.snapshot(),beforeLedger);assert.deepEqual(session.getEntries(),beforeEntries);assert.equal(calls,1);
  semantic.parents.release(parent.operationId);core.release(generic.data.value.batchId);assert.equal(core.memory.retainedBytes,0);assert.equal(core.memory.reservedBytes,0);
  assert.deepEqual(ledger.snapshot(),beforeLedger);
});

test('SM-34 public imports and core remain independent of filesystem acquisition',async()=>{
  for(const file of readdirSync(new URL('../src/core/',import.meta.url)).filter(x=>x.endsWith('.ts'))){
    const source=readFileSync(new URL('../src/core/'+file,import.meta.url),'utf8');assert.doesNotMatch(source,/from\s+["'](?:node:fs|node:child_process|\.\.\/filesystem)/,file);
  }
  const before=process.getActiveResourcesInfo();const lib=await import('pi-decision-tools');
  assert.deepEqual(Object.keys(lib).sort(),['connect','protocolVersion']);assert.deepEqual(process.getActiveResourcesInfo(),before);
});
