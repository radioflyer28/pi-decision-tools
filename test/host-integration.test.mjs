import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_LIMITS } from '../dist/core/validation.js';
import { loadExtensions } from '../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js';
import { ExtensionRunner } from '../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js';
import { wrapRegisteredTools } from '../node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/wrapper.js';
import { NestedToolCallRunner } from '../node_modules/@earendil-works/pi-coding-agent/dist/core/nested-tool-calls.js';
import { runToolCall } from '../node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js';
import { SessionManager } from '../node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js';
import { createEventBus } from '../node_modules/@earendil-works/pi-coding-agent/dist/core/event-bus.js';
import { connect } from 'pi-decision-tools';
import { temporaryFixture, FakeClassifier } from './helpers/fixtures.mjs';
const model={type:'classifier',provider:'fake',id:'fixture',name:'Fixture',api:'fake',baseUrl:'https://fixture.invalid',input:['text'],contextWindow:10000,
  cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
const input={items:[{id:'a',inputVersion:'1',state:{synthetic:true}}],rubricVersion:'v1',
  questions:{q:{type:'bool',instructions:'Fixture?',criteria:{true:'yes',false:'no'}}},run:{}};

test('real Pi loader, runner, tool pipeline and nested recorder share one owner across physical copies',async t=>{
  const f=temporaryFixture(t),previous=process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR=f.root;process.env.JITI_FS_CACHE='false';
  t.after(()=>{process.env.PI_CODING_AGENT_DIR=previous;delete process.env.JITI_FS_CACHE;});
  writeFileSync(f.configPath,JSON.stringify({version:1,families:{generic:true,semantic:true},limits:{...DEFAULT_LIMITS,requests:3,inputBytes:10000}}));
  const paths=[];
  for(const name of ['a','b']){
    const root=join(f.root,name);mkdirSync(root);writeFileSync(join(root,'package.json'),'{"type":"module"}');
    cpSync(new URL('../dist/',import.meta.url),join(root,'dist'),{recursive:true});paths.push(join(root,'dist','extension.js'));
  }
  const bus=createEventBus(),loaded=await loadExtensions(paths,f.root,bus);
  assert.deepEqual(loaded.errors,[]);assert.equal(loaded.extensions.length,2);
  assert.equal(loaded.extensions.reduce((n,e)=>n+e.commands.size,0),1);
  const manager=SessionManager.create(f.root,f.sessions);manager.appendMessage({role:'user',content:'Synthetic host integration.',timestamp:Date.now()});
  const fake=new FakeClassifier(),registry={getAvailableOfType:async()=>[model],classify:fake.classify};
  const runner=new ExtensionRunner(loaded.extensions,loaded.runtime,f.root,manager,registry);
  const errors=[];runner.onError(e=>errors.push(e));let tools=[];const events=[];
  const nested=new NestedToolCallRunner({getTools:()=>tools,isSequential:()=>false,emit:async e=>{events.push(e);},
    runToolCall:(call,_parent,signal,onUpdate)=>runToolCall(call,{tools,signal,onUpdate,assistantMessage:{content:[]},context:{messages:[],tools}})});
  runner.bindCore({appendEntry:(type,data)=>manager.appendCustomEntry(type,data),
    refreshTools:()=>{tools=wrapRegisteredTools(runner.getAllRegisteredTools(),runner);},
    getAllTools:()=>tools,getActiveTools:()=>[],getCommands:()=>[],getSettings:()=>({}),getSessionName:()=>undefined},
    {getModel:()=>undefined,getScopedModels:()=>[],isIdle:()=>true,isProjectTrusted:()=>true,getSignal:()=>undefined,
      abort:()=>{},hasPendingMessages:()=>false,shutdown:()=>{},getContextUsage:()=>undefined,compact:()=>{},getSystemPrompt:()=>'',
      getCallableTools:()=>tools,executeTool:(...args)=>nested.execute(...args)});
  await runner.emit({type:'session_start',reason:'startup'});
  assert.deepEqual(errors,[]);assert.equal(tools.length,8);
  assert.ok(runner.getAllRegisteredTools().every(tool=>tool.definition.exposure==='codemode'));
  const context=runner.createToolContext('outer',undefined);
  const denied=await context.executeTool('decision_submit',input);
  assert.equal(denied.result.structuredContent.error.code,'disabled');assert.equal(denied.isError,true);
  const command=loaded.extensions.flatMap(e=>[...e.commands.values()]).find(c=>c.name==='decisions');
  await command.handler('enable fake fixture',runner.createCommandContext());
  const result=await context.executeTool('decision_submit',input);
  assert.equal(result.isError,false,JSON.stringify(result));assert.equal(result.result.structuredContent.ok,true);
  const batchId=result.result.structuredContent.value.batchId;
  await context.executeTool('decision_results',{batchId});
  const reuse=await context.executeTool('decision_submit',input);assert.equal(reuse.result.usage,undefined);
  const record=nested.takeRecord('outer');assert.equal(record.usage.totalTokens,10);
  assert.equal(record.calls.calls.length,4);assert.equal(record.calls.complete,true);assert.equal(fake.calls.length,1);
  assert.ok(events.every(e=>e.parentToolCallId==='outer'));
  const client=connect({events:bus},runner.createContext());
  assert.equal(client.results({batchId}).data.value.ledger.chargedRequests,1);
  const libraries=await Promise.all(paths.map(p=>import(pathToFileURL(join(dirname(p),'index.js')).href)));
  const clients=libraries.map(l=>l.connect({events:bus},runner.createContext()));
  const parallel=await Promise.all([...clients,client].map((c,actor)=>c.submit({...input,
    items:[0,1].map(i=>({id:String(i),inputVersion:'1',state:{actor,item:i}}))})));
  assert.equal(fake.calls.length,3);assert.ok(fake.peak<=2);
  assert.equal(client.results({batchId}).data.value.ledger.chargedRequests,3);
  assert.equal(client.results({batchId}).data.value.ledger.remainingRequests,0);
  assert.equal(parallel.reduce((n,r)=>n+(r.usageDelta?.totalTokens??0),0),20);
  assert.ok(parallel.some(r=>r.data.ok&&r.data.value.counts.pending>0),JSON.stringify(parallel));
  await runner.emit({type:'session_shutdown',reason:'reload'});
  assert.equal((await client.submit(input)).data.error.code,'runtime_expired');
  assert.deepEqual(errors,[]);
});
