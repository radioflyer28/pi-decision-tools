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
import { createCodemodeToolDefinition } from '../node_modules/@earendil-works/pi-coding-agent/dist/extensions/codemode/tool.js';
import { runToolCall } from '../node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js';
import { SessionManager } from '../node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js';
import { createEventBus } from '../node_modules/@earendil-works/pi-coding-agent/dist/core/event-bus.js';
import { temporaryFixture, FakeClassifier, fakeUsage } from './helpers/fixtures.mjs';
const model={type:'classifier',provider:'fake',id:'fixture',name:'Fixture',api:'fake',baseUrl:'https://fixture.invalid',input:['text'],contextWindow:10000,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
const semantic=(text='synthetic',count=1)=>({predicate:'Supported?',records:Array.from({length:count},(_,i)=>({id:String(i),text:`${text}-${i}`})),run:{}});
const generic=actor=>({items:[{id:'a',inputVersion:'1',state:{actor}}],rubricVersion:'v1',questions:{q:{type:'bool',instructions:'Fixture?',criteria:{true:'yes',false:'no'}},s:{type:'score',instructions:'Level?',criteria:['low','high']},c:{type:'choice',instructions:'Label?',criteria:{first:'first',second:'second'}}},run:{}});
async function harness(t,families,actions=[],limits={}){
  const f=temporaryFixture(t),previous=process.env.PI_CODING_AGENT_DIR;process.env.PI_CODING_AGENT_DIR=f.root;process.env.JITI_FS_CACHE='false';
  t.after(()=>{process.env.PI_CODING_AGENT_DIR=previous;delete process.env.JITI_FS_CACHE;});
  writeFileSync(f.configPath,JSON.stringify({version:1,families,fileExclusions:['private.txt'],limits:{...DEFAULT_LIMITS,requests:4,inputBytes:50000,maxRetries:0,...limits}}));
  const paths=[];
  for(const name of ['a','b']){const root=join(f.root,name);mkdirSync(root);writeFileSync(join(root,'package.json'),'{"type":"module"}');cpSync(new URL('../dist/',import.meta.url),join(root,'dist'),{recursive:true});paths.push(join(root,'dist','extension.js'));}
  const bus=createEventBus(),loaded=await loadExtensions(paths,f.root,bus);assert.deepEqual(loaded.errors,[]);
  assert.equal(loaded.extensions.reduce((n,e)=>n+e.commands.size,0),1);
  const manager=SessionManager.create(f.root,f.sessions);manager.appendMessage({role:'user',content:'Synthetic semantic host fixture.',timestamp:Date.now()});
  const fake=new FakeClassifier(...actions),runner=new ExtensionRunner(loaded.extensions,loaded.runtime,f.root,manager,{getAvailableOfType:async()=>[model],classify:fake.classify});
  const errors=[];runner.onError(e=>errors.push(e));let tools=[];
  const callable=()=>tools.filter(t=>runner.getAllRegisteredTools().find(r=>r.definition.name===t.name)?.definition.exposure!=='hidden');
  const nested=new NestedToolCallRunner({getTools:callable,isSequential:()=>false,emit:async()=>{},runToolCall:(call,_parent,signal,onUpdate)=>runToolCall(call,{tools:callable(),signal,onUpdate,assistantMessage:{content:[]},context:{messages:[],tools:callable()}})});
  runner.bindCore({appendEntry:(type,data)=>manager.appendCustomEntry(type,data),refreshTools:()=>{tools=wrapRegisteredTools(runner.getAllRegisteredTools(),runner);},getAllTools:()=>tools,getActiveTools:()=>[],getCommands:()=>[],getSettings:()=>({}),getSessionName:()=>undefined},
    {getModel:()=>undefined,getScopedModels:()=>[],isIdle:()=>true,isProjectTrusted:()=>true,getSignal:()=>undefined,abort:()=>{},hasPendingMessages:()=>false,shutdown:()=>{},getContextUsage:()=>undefined,compact:()=>{},getSystemPrompt:()=>'',getCallableTools:callable,executeTool:(...args)=>nested.execute(...args)});
  await runner.emit({type:'session_start',reason:'startup'});assert.equal(tools.length,8);assert.deepEqual(errors,[]);
  const command=loaded.extensions.flatMap(e=>[...e.commands.values()]).find(c=>c.name==='decisions');
  await command.handler('enable fake fixture',runner.createCommandContext());
  const libraries=await Promise.all(paths.map(p=>import(pathToFileURL(join(dirname(p),'index.js')).href)));
  const clients=libraries.map(l=>l.connect({events:bus},runner.createContext()));
  const code=createCodemodeToolDefinition({models:false});
  const script=async(id,source)=>{
    const result=await code.execute(id,{code:source},undefined,undefined,runner.createToolContext(id,undefined));
    assert.notEqual(result.isError,true,JSON.stringify(result));return {result,record:nested.takeRecord(id)};
  };
  t.after(async()=>{await runner.emit({type:'session_shutdown',reason:'quit'});assert.deepEqual(errors,[]);});
  return {runner,fake,clients,script,nested,tools,callable,f,session:manager,command:async text=>command.handler(text,runner.createCommandContext())};
}

for(const genericEnabled of [false,true])for(const semanticEnabled of [false,true])test(`actual Pi/codemode family matrix generic=${genericEnabled} semantic=${semanticEnabled}`,async t=>{
  const h=await harness(t,{generic:genericEnabled,semantic:semanticEnabled});
  assert.equal(h.callable().length,(genericEnabled?3:0)+(semanticEnabled?5:0));
  writeFileSync(join(h.f.root,'matrix.txt'),'synthetic matrix file');
  const source=semanticEnabled?`
    const filtered=await tools.semantic_filter(${JSON.stringify(semantic())});
    if(!filtered.ok) throw new Error(JSON.stringify(filtered));
    const p=filtered.value;
    const prepared=await tools.semantic_search({predicate:'Fixture?',mode:'discovery',scope:{paths:['matrix.txt']},run:{maxRequests:1}});
    if(!prepared.ok||prepared.value.mode!=='discovery'||prepared.value.coverage.initial.judged!==1||prepared.value.view!=='new_matches') throw new Error('bad discovery execution');
    const read=await tools.semantic_results({operationId:p.operationId,policy:{version:1,minMatchProbability:1}});
    const evidence=await tools.semantic_evidence({operationId:p.operationId,evidenceIds:[p.items[0].evidence.evidenceId],checkCurrent:true});
    if(!read.ok||!evidence.ok||evidence.value.snippets[0].freshness!=='unverified') throw new Error('bad view');
    return {judged:read.value.coverage.initial.judged};`
    : `return ALL_TOOLS.map(t=>t.name);`;
  const {result,record}=await h.script('code',source);
  assert.equal(result.usage,undefined);assert.equal(record?.usage?.totalTokens,semanticEnabled?20:undefined);
  assert.equal(h.fake.calls.length,semanticEnabled?2:0);
  const output=result.content.filter(block=>block.type==='text').map(block=>block.text).join('\n');
  if(semanticEnabled){assert.equal(record.calls.calls.length,4);assert.match(output,/"judged":\s*1/);}
  else {assert.ok(!output.includes('semantic_filter'));if(genericEnabled)assert.ok(output.includes('decision_submit'));}
  // Even hidden definitions reject fixed-family execution when bypassing host exposure.
  if(!semanticEnabled){for(const name of ['semantic_filter','semantic_search']){
    const tool=h.tools.find(t=>t.name===name);const denied=await tool.execute('hidden',name==='semantic_filter'?semantic():{predicate:'Fixture?',mode:'discovery',scope:{paths:['matrix.txt']}});
    assert.equal(denied.structuredContent.error.code,'family_disabled');
  }}
  const library=await h.clients[0].submit(generic('independent-library'));assert.equal(library.data.ok,true);
  assert.deepEqual(Object.fromEntries(Object.entries(library.data.value.items[0].answers).map(([key,value])=>[key,value.type])),{q:'bool',s:'score',c:'choice'});
});

test('actual host retains unknown liability and shares concurrency/allowance across semantic and physical library copies',async t=>{
  const h=await harness(t,{generic:true,semantic:true},[async()=>({api:'fake',provider:'fake',model:'fixture',answers:{},stopReason:'error',timestamp:0})]);
  const context=h.runner.createToolContext('unknown',undefined);
  const unknown=await context.executeTool('semantic_filter',semantic('unknown'));
  const p=unknown.result.structuredContent.value;
  assert.equal(p.diagnostics.unknownUsageAttempts,1);assert.equal(p.coverage.initial.failed,1);assert.equal(unknown.result.usage,undefined);
  await context.executeTool('semantic_results',{operationId:p.operationId});assert.equal(h.nested.takeRecord('unknown').usage,undefined);
  const [semanticRun,...libraryRuns]=await Promise.all([
    h.script('parallel',`return await tools.semantic_filter(${JSON.stringify(semantic('parallel',6))});`),
    ...h.clients.map((c,i)=>c.submit(generic(i))),
  ]);
  assert.equal(h.fake.calls.length,4);assert.ok(h.fake.peak<=2);
  const totals=(await context.executeTool('semantic_results',{operationId:p.operationId})).result.structuredContent.value.ledger;
  assert.equal(totals.chargedRequests,4);assert.equal(totals.remainingRequests,0);
  assert.equal((semanticRun.record?.usage?.totalTokens??0)+libraryRuns.reduce((n,r)=>n+(r.usageDelta?.totalTokens??0),0),30);
  assert.equal(semanticRun.result.usage,undefined);
});

test('actual Pi codemode search uses the host root, exclusions and one usage boundary',async t=>{
  const h=await harness(t,{generic:true,semantic:true});
  assert.ok(h.tools.some(tool=>tool.name==='semantic_search'),'host must register systematic search');
  for(const [name,text] of [['a.txt','no lexical overlap'],['b.txt','also unrelated'],['private.txt','synthetic private'],['.env','synthetic sensitive']])writeFileSync(join(h.f.root,name),text);
  const {result,record}=await h.script('search',`
    const first=await tools.semantic_search({predicate:'Cancellation is checked?',scope:{paths:['b.txt','a.txt','private.txt','.env']},run:{maxRequests:1}});
    if(!first.ok) throw new Error(JSON.stringify(first));const p=first.value;
    if(p.kind!=='search'||p.complete||p.coverage.initial.pending!==1||p.coverage.files.excluded!==2) throw new Error('search coverage');
    const next=await tools.semantic_continue({operationId:p.operationId,expectedIdentity:p.identity,run:{maxRequests:1}});
    if(!next.ok||!next.value.complete||next.value.coverage.initial.judged!==2) throw new Error(JSON.stringify(next));
    const view=await tools.semantic_results({operationId:p.operationId,policy:{version:1,minMatchProbability:1}});
    const evidence=await tools.semantic_evidence({operationId:p.operationId,evidenceIds:[p.items[0].evidence.evidenceId],checkCurrent:true});
    if(!evidence.ok||evidence.value.snippets[0].freshness!=='unchanged') throw new Error(JSON.stringify(evidence));
    return {kind:view.value.kind,judged:view.value.coverage.initial.judged,charged:view.value.ledger.chargedRequests};`);
  assert.equal(result.usage,undefined);assert.equal(record.usage.totalTokens,20);assert.equal(record.calls.calls.length,4);
  assert.deepEqual(h.fake.calls.map(c=>c.request.state.evidence.source.path),['a.txt','b.txt']);
  const output=result.content.filter(b=>b.type==='text').map(b=>b.text).join('\n');assert.match(output,/"charged":\s*2/);
});

for(const mode of ['systematic','discovery'])test(`actual ${mode} file search survives compaction and disabled views but expires on successful navigation`,async t=>{
  const h=await harness(t,{generic:true,semantic:true});writeFileSync(join(h.f.root,'life.txt'),'z\n'.repeat(120));
  const call=async(name,args)=>(await h.runner.createToolContext('life',undefined).executeTool(name,args)).result.structuredContent;
  const first=await call('semantic_search',{mode,predicate:'Fixture?',scope:{paths:['life.txt']},run:{maxRequests:1}});assert.equal(first.ok,true);const p=first.value;
  const leaf=h.session.getEntries().find(e=>e.type==='message').id;
  h.session.appendCompaction('Synthetic summary.',leaf,20);await h.runner.emit({type:'session_compact'});
  assert.equal((await call('semantic_results',{operationId:p.operationId})).value.revision,p.revision);
  await h.runner.emit({type:'session_before_tree'});
  assert.equal((await call('semantic_results',{operationId:p.operationId})).ok,true);
  assert.equal((await call('semantic_continue',{operationId:p.operationId,expectedIdentity:p.identity,run:{}})).error.code,'disabled');
  await h.command('enable fake fixture');
  assert.equal((await call('semantic_continue',{operationId:p.operationId,expectedIdentity:p.identity,run:{}})).value.complete,true);
  await h.runner.emit({type:'session_before_tree'});h.session.branch(leaf);await h.runner.emit({type:'session_tree'});
  assert.equal((await call('semantic_results',{operationId:p.operationId})).error.code,'search_expired');
  await h.command('enable fake fixture');const fresh=await call('semantic_search',{mode,predicate:'Fixture?',scope:{paths:['life.txt','private.txt']}});
  assert.equal(fresh.ok,true);assert.equal(fresh.value.coverage.files.excluded,1);assert.equal(fresh.value.ledger.chargedRequests,2);assert.equal(h.fake.calls.length,2);
  await h.runner.emit({type:'session_start',reason:'resume'});assert.equal((await call('semantic_results',{operationId:fresh.value.operationId})).error.code,'search_expired');
  await h.command('enable fake fixture');const resumed=await call('semantic_search',{mode,predicate:'Fixture?',scope:{paths:['life.txt']}});assert.equal(resumed.value.ledger.chargedRequests,2);
});


test('actual QuickJS discovery yields new hits through one physical-copy owner and usage boundary',async t=>{
  const actions=Array.from({length:24},()=>async()=>({api:'fake',provider:'fake',model:'fixture',stopReason:'stop',timestamp:0,usage:fakeUsage(),answers:{relevance:{type:'choice',choice:'match',probabilities:{match:1,no_match:0,insufficient_context:0},confidence:1}}}));
  const h=await harness(t,{generic:true,semantic:true},actions,{requests:40,inputBytes:1048576});writeFileSync(join(h.f.root,'discovery.txt'),'synthetic\n'.repeat(64+56*23));
  const call=async(name,input)=>(await h.runner.createToolContext('direct-discovery',undefined).executeTool(name,input)).result;
  const first=await call('semantic_search',{predicate:'Fixture?',mode:'discovery',scope:{paths:['discovery.txt','private.txt']},run:{}}),p=first.structuredContent.value;
  assert.equal(p.stopReason,'target_reached');assert.equal(p.items.length,8);assert.equal(first.usage.totalTokens,80);assert.equal(p.coverage.files.excluded,1);
  const ids=p.items.map(i=>i.evidence.evidenceId);
  const {result,record}=await h.script('discovery-continue',`
    const next=await tools.semantic_continue({operationId:${JSON.stringify(p.operationId)},expectedIdentity:${JSON.stringify(p.identity)},run:{}});
    if(!next.ok||next.value.stopReason!=='target_reached'||next.value.items.length!==8||next.value.yieldProgress.matched!==8) throw new Error(JSON.stringify(next));
    const old=${JSON.stringify(ids)};if(next.value.items.some(i=>old.includes(i.evidence.evidenceId))) throw new Error('repeated hit');
    const all=await tools.semantic_results({operationId:next.value.operationId,view:'all',limit:100});
    const evidence=await tools.semantic_evidence({operationId:next.value.operationId,evidenceIds:[next.value.items[0].evidence.evidenceId],checkCurrent:true});
    if(!all.ok||all.value.items.length!==24||!evidence.ok||evidence.value.snippets[0].freshness!=='unchanged') throw new Error('bad retained views');
    return {newHits:next.value.items.length,judged:next.value.coverage.initial.judged};`);
  assert.equal(result.usage,undefined);assert.equal(record.usage.totalTokens,80);assert.equal(record.calls.calls.length,3);assert.equal(h.fake.calls.length,16);
  const last=await call('semantic_continue',{operationId:p.operationId,expectedIdentity:p.identity,run:{}});assert.equal(last.structuredContent.value.complete,true);assert.equal(last.structuredContent.value.items.length,8);assert.equal(last.usage.totalTokens,80);
  const libraries=await Promise.all(h.clients.map((c,i)=>c.submit(generic('after-discovery-'+i))));assert.ok(libraries.every(r=>r.data.ok));assert.equal(h.fake.calls.length,26);assert.ok(h.fake.peak<=2);
  const totals=(await call('semantic_results',{operationId:p.operationId,view:'matches',limit:100})).structuredContent.value;assert.equal(totals.items.length,24);assert.equal(totals.ledger.chargedRequests,26);assert.equal(totals.usage[0].usage.totalTokens,240);
  await h.command('disable');assert.equal((await call('semantic_results',{operationId:p.operationId})).structuredContent.ok,true);await h.command('release '+p.operationId);assert.equal((await call('semantic_results',{operationId:p.operationId})).structuredContent.error.code,'search_expired');
});
