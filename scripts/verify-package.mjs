// Local offline packaging audit. Does not publish, load real config or call providers.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),temporary=mkdtempSync(join(tmpdir(),'pi-decision-package-'));
const npm=process.env.npm_execpath;assert.ok(npm,'Run via npm run verify:package');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(path|systemroot|windir|temp|tmp|comspec|pathext|number_of_processors)$/i.test(key)));
const blank=join(temporary,'user.npmrc'),globalConfig=join(temporary,'global.npmrc');writeFileSync(blank,'');writeFileSync(globalConfig,'');
Object.assign(env,{HOME:temporary,USERPROFILE:temporary,PI_CODING_AGENT_DIR:temporary,
  NPM_CONFIG_CACHE:join(temporary,'cache'),NPM_CONFIG_USERCONFIG:blank,NPM_CONFIG_GLOBALCONFIG:globalConfig,
  NPM_CONFIG_MIN_RELEASE_AGE:'7',NPM_CONFIG_OFFLINE:'true',
  NODE_OPTIONS:`--import="${new URL('../test/helpers/offline.mjs',import.meta.url).href}"`});
function run(program,args,cwd=root,extraEnv={}){
  const r=spawnSync(program,args,{cwd,env:{...env,...extraEnv},encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  assert.equal(r.status,0,`${args.join(' ')}\n${r.error??''}\n${r.stdout}\n${r.stderr}`);return r.stdout;
}
try{
  const [pack]=JSON.parse(run(process.execPath,[npm,'pack','--ignore-scripts','--json','--pack-destination',temporary]));
  const names=pack.files.map(f=>f.path);const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
  for(const p of ['package.json','dist/index.js','dist/index.d.ts','dist/extension.js','dist/extension.d.ts','README.md','docs/usage.md','docs/semantic-usage.md','docs/semantic-verification.md','dist/pi/semantic-tools.js','dist/filesystem/capture.js','dist/filesystem/source.js','dist/filesystem/process.js','docs/filesystem-evidence.md','pi-decision-tools-design.md'])assert.ok(names.includes(p),p);
  assert.ok(names.every(p=>!/^(?:node_modules|src|test|scripts|\.pi|\.agents|openspec)\//.test(p)&&!/(?:auth\.json|\.env|package-lock\.json)$/.test(p)));
  assert.equal(manifest.private,true);assert.equal(manifest.type,'module');assert.equal(manifest.bundleDependencies,undefined);
  assert.deepEqual(Object.keys(manifest.peerDependencies).sort(),['@earendil-works/pi-ai','@earendil-works/pi-coding-agent','typebox']);
  const consumer=join(temporary,'consumer');mkdirSync(consumer);writeFileSync(join(consumer,'package.json'),'{"name":"local-decision-consumer","private":true,"type":"module"}');
  run(process.execPath,[npm,'install',join(temporary,pack.filename),'--offline','--ignore-scripts','--legacy-peer-deps','--no-audit','--no-fund'],consumer);
  // The host supplies its unbundled peers. Use only the already verified local
  // host installation, not a registry install or bundled private dependency copy.
  for(const peer of ['@earendil-works','@types','typebox'])symlinkSync(join(root,'node_modules',peer),join(consumer,'node_modules',peer),'junction');
  writeFileSync(join(consumer,'runtime.mjs'),`import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {Check} from 'typebox/value';
const before=process.getActiveResourcesInfo();const lib=await import('pi-decision-tools');
assert.deepEqual(process.getActiveResourcesInfo(),before);assert.equal(lib.protocolVersion,1);
assert.deepEqual(Object.keys(lib).sort(),['connect','protocolVersion']);
const extension=await import('pi-decision-tools/extension');assert.equal(typeof extension.default,'function');
const {discoverAndLoadExtensions,ExtensionRunner,SessionManager}=await import('@earendil-works/pi-coding-agent');
const {fileURLToPath}=await import('node:url');process.env.JITI_FS_CACHE='false';
const loaded=await discoverAndLoadExtensions([fileURLToPath(import.meta.resolve('pi-decision-tools/extension'))],process.cwd(),process.env.PI_CODING_AGENT_DIR);
assert.deepEqual(loaded.errors,[]);assert.equal(loaded.extensions.reduce((n,e)=>n+e.commands.size,0),1);
const manager=SessionManager.create(process.cwd(),process.env.PI_CODING_AGENT_DIR);
manager.appendMessage({role:'user',content:'Synthetic installed-package test.',timestamp:Date.now()});let calls=0;
const model={type:'classifier',provider:'fake',id:'installed',name:'Installed fixture',api:'fake',baseUrl:'https://fixture.invalid',input:['text'],contextWindow:10000,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
const usage={input:7,output:3,cacheRead:0,cacheWrite:0,totalTokens:10,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}};
const registry={getAvailableOfType:async()=>[model],classify:async(_model,request)=>{
  calls++;return {api:'fake',provider:'fake',model:'installed',stopReason:'stop',timestamp:0,usage,
    answers:Object.fromEntries(Object.entries(request.questions).map(([key,q])=>[key,q.type==='bool'?{type:'bool',probability:0.75}:
      {type:'choice',choice:'match',confidence:0.75,probabilities:{match:0.75,no_match:0.25,insufficient_context:0}}]))};
}};
const runner=new ExtensionRunner(loaded.extensions,loaded.runtime,process.cwd(),manager,registry);
runner.bindCore({appendEntry:(type,data)=>manager.appendCustomEntry(type,data),refreshTools:()=>{},getAllTools:()=>[],getActiveTools:()=>[],getCommands:()=>[],getSettings:()=>({}),getSessionName:()=>undefined},
  {getModel:()=>undefined,getScopedModels:()=>[],isIdle:()=>true,isProjectTrusted:()=>true,getSignal:()=>undefined,abort:()=>{},hasPendingMessages:()=>false,shutdown:()=>{},getContextUsage:()=>undefined,compact:()=>{},getSystemPrompt:()=>''});
const errors=[];runner.onError(e=>errors.push(e));await runner.emit({type:'session_start',reason:'startup'});
const names=['decision_continue','decision_results','decision_submit','semantic_continue','semantic_evidence','semantic_filter','semantic_results','semantic_search'];
const inventory=(generic,semantic)=>{
  const registered=runner.getAllRegisteredTools();assert.deepEqual(registered.map(t=>t.definition.name).sort(),names);
  for(const {definition:d} of registered)assert.equal(d.exposure,(d.name.startsWith('decision_')?generic:semantic)?'codemode':'hidden');
};
const call=async(name,args)=>{
  const definition=runner.getToolDefinition(name),result=await definition.execute('fixture',args,undefined,undefined,runner.createToolContext('fixture',undefined));
  assert.equal(Check(definition.outputSchema,result.structuredContent),true,JSON.stringify(result));
  assert.equal(result.isError,!result.structuredContent.ok);return result;
};
const genericInput={items:[{id:'a',inputVersion:'1',state:{}}],rubricVersion:'1',questions:{q:{type:'bool',instructions:'Fixture?',criteria:{true:'yes',false:'no'}}},run:{}};
const records={predicate:'A definite time is stated.',records:[{id:'a',text:'Synthetic time: noon.'},{id:'b',text:'Synthetic time: midnight.'}]};
inventory(true,false);
assert.equal((await call('decision_submit',genericInput)).structuredContent.error.code,'disabled');
assert.equal((await call('semantic_filter',{...records,run:{}})).structuredContent.error.code,'disabled');assert.equal(calls,0);
const limits={requests:32,inputBytes:50000,concurrency:2,maxWorkMs:10000,maxAttemptMs:5000,maxRetries:1};
const configure=async(generic,semantic)=>{
  writeFileSync(join(process.env.PI_CODING_AGENT_DIR,'decision-tools.json'),JSON.stringify({version:1,families:{generic,semantic},fileExclusions:['private.txt'],limits}));
  await runner.emit({type:'session_start',reason:'resume'});inventory(generic,semantic);
};
const command=loaded.extensions.flatMap(e=>[...e.commands.values()]).find(c=>c.name==='decisions');
const control=async(text)=>command.handler(text,runner.createCommandContext());
await configure(true,true);await control('enable fake installed');
const first=await call('semantic_filter',{...records,run:{maxRequests:1}}),p=first.structuredContent.value;
assert.equal(p.coverage.initial.judged,1);assert.equal(p.coverage.initial.pending,1);assert.equal(first.usage.totalTokens,10);
const done=await call('semantic_continue',{operationId:p.operationId,expectedIdentity:p.identity,run:{maxRequests:1}});
assert.equal(done.structuredContent.value.complete,true);assert.equal(done.usage.totalTokens,10);
const view=await call('semantic_results',{operationId:p.operationId,policy:{version:1,minMatchProbability:0.9}});
assert.equal(view.usage,undefined);assert.equal(view.structuredContent.value.outcomeCounts.unresolved,2);
assert.equal(view.structuredContent.value.items[0].raw.answer.choice,'match');
const evidence=await call('semantic_evidence',{operationId:p.operationId,evidenceIds:[p.items[0].evidence.evidenceId],checkCurrent:true});
assert.equal(evidence.usage,undefined);assert.equal(evidence.structuredContent.value.snippets[0].freshness,'unverified');
const generic=await call('decision_submit',genericInput);assert.equal(generic.structuredContent.ok,true);assert.equal(generic.usage.totalTokens,10);assert.equal(calls,3);
writeFileSync(join(process.cwd(),'search.txt'),'synthetic source line\\n'.repeat(70));
writeFileSync(join(process.cwd(),'private.txt'),'synthetic excluded file');writeFileSync(join(process.cwd(),'.env'),'synthetic sensitive file');
const search=await call('semantic_search',{predicate:'Local evidence exists?',scope:{paths:['search.txt','private.txt','.env']}}),sp=search.structuredContent.value;
assert.equal(sp.kind,'search');assert.equal(sp.state,'prepared');assert.equal(sp.coverage.initial.pending,2);assert.equal(sp.coverage.files.excluded,2);assert.equal(calls,3);
const searchFirst=await call('semantic_continue',{operationId:sp.operationId,expectedIdentity:sp.identity,run:{maxRequests:1}});
assert.equal(searchFirst.structuredContent.value.coverage.initial.pending,1);assert.equal(searchFirst.usage.totalTokens,10);
const searchDone=await call('semantic_continue',{operationId:sp.operationId,expectedIdentity:sp.identity,run:{maxRequests:1}});
assert.equal(searchDone.structuredContent.value.complete,true);assert.equal(searchDone.usage.totalTokens,10);assert.equal(calls,5);
const searchView=await call('semantic_results',{operationId:sp.operationId,policy:{version:1,minMatchProbability:0.9}});
assert.equal(searchView.structuredContent.value.outcomeCounts.unresolved,2);assert.equal(searchView.usage,undefined);
writeFileSync(join(process.cwd(),'search.txt'),'changed synthetic source');
const fileEvidence=await call('semantic_evidence',{operationId:sp.operationId,evidenceIds:[sp.items[0].evidence.evidenceId],checkCurrent:true});
assert.equal(fileEvidence.structuredContent.value.snippets[0].freshness,'changed');assert.match(fileEvidence.structuredContent.value.snippets[0].text,/synthetic source line/);assert.equal(fileEvidence.usage,undefined);
writeFileSync(join(process.cwd(),'discovery.txt'),'discovery source\\n'.repeat(64+56*15));
const discovery=await call('semantic_search',{predicate:'Local evidence exists?',mode:'discovery',scope:{paths:['discovery.txt','private.txt']},policy:{version:1,minMatchProbability:0.7}}),dp=discovery.structuredContent.value;
assert.equal(dp.mode,'discovery');assert.equal(dp.items.length,0);assert.equal(dp.coverage.initial.pending,16);assert.equal(dp.coverage.files.excluded,1);assert.equal(calls,5);
const yielded=await call('semantic_continue',{operationId:dp.operationId,expectedIdentity:dp.identity,run:{}}),yp=yielded.structuredContent.value;
assert.equal(yp.stopReason,'target_reached');assert.equal(yp.items.length,8);assert.equal(yp.yieldProgress.matched,8);assert.equal(yielded.usage.totalTokens,80);
const stricter=await call('semantic_results',{operationId:dp.operationId,policy:{version:1,minMatchProbability:0.9}});
assert.equal(stricter.structuredContent.value.items.length,0);assert.equal(stricter.structuredContent.value.yieldProgress.matched,8);assert.equal(stricter.usage,undefined);
const more=await call('semantic_continue',{operationId:dp.operationId,expectedIdentity:dp.identity,run:{}}),mp=more.structuredContent.value;
assert.equal(mp.complete,true);assert.equal(mp.items.length,8);assert.ok(mp.items.every(i=>!yp.items.some(old=>old.evidence.evidenceId===i.evidence.evidenceId)));assert.equal(more.usage.totalTokens,80);assert.equal(calls,21);
const allDiscovery=await call('semantic_results',{operationId:dp.operationId,view:'all'});assert.equal(allDiscovery.structuredContent.value.items.length,16);assert.equal(allDiscovery.usage,undefined);
const discoveredEvidence=await call('semantic_evidence',{operationId:dp.operationId,evidenceIds:[mp.items[0].evidence.evidenceId],checkCurrent:true});assert.equal(discoveredEvidence.structuredContent.value.snippets[0].freshness,'unchanged');assert.equal(discoveredEvidence.usage,undefined);
await control('disable');assert.equal((await call('semantic_results',{operationId:dp.operationId})).structuredContent.ok,true);
await control('release '+dp.operationId);assert.equal((await call('semantic_results',{operationId:dp.operationId})).structuredContent.error.code,'search_expired');
assert.equal((await call('semantic_results',{operationId:sp.operationId})).structuredContent.ok,true);
await control('release '+sp.operationId);assert.equal((await call('semantic_results',{operationId:sp.operationId})).structuredContent.error.code,'search_expired');
assert.equal((await call('semantic_results',{operationId:p.operationId})).structuredContent.ok,true);
await control('release '+p.operationId);assert.equal((await call('semantic_results',{operationId:p.operationId})).structuredContent.error.code,'search_expired');
const batchId=generic.structuredContent.value.batchId;
assert.equal((await call('decision_results',{batchId})).structuredContent.value.ledger.chargedRequests,21);
for(const g of [false,true])for(const s of [false,true]){
  await configure(g,s);assert.equal((await call('semantic_results',{operationId:p.operationId})).structuredContent.error.code,'search_expired');
  await control('enable fake installed');
  const prepared=await call('semantic_filter',records);
  if(s){assert.equal(prepared.structuredContent.value.state,'prepared');assert.equal(prepared.structuredContent.value.ledger.chargedRequests,21);}
  else assert.equal(prepared.structuredContent.error.code,'family_disabled');
  const discoveryPrepared=await call('semantic_search',{predicate:'Fixture?',mode:'discovery',scope:{paths:['discovery.txt']}});
  if(s){assert.equal(discoveryPrepared.structuredContent.value.mode,'discovery');assert.equal(discoveryPrepared.structuredContent.value.ledger.chargedRequests,21);}
  else assert.equal(discoveryPrepared.structuredContent.error.code,'family_disabled');
}
assert.equal(calls,21);assert.deepEqual(errors,[]);await runner.emit({type:'session_shutdown',reason:'quit'});
console.log('installed ESM exports, inert import, eight-tool family matrix and record/systematic/discovery execution/yields/continuation/views/evidence/release verified');`);
  const scoped=env.NODE_OPTIONS+` --permission --allow-fs-read="${resolve(root).replaceAll('\\','/')}" --allow-fs-read="${temporary.replaceAll('\\','/')}" --allow-fs-write="${temporary.replaceAll('\\','/')}" --disable-warning=SecurityWarning`;
  const metadata=[];for(let directory=dirname(temporary);;directory=dirname(directory)){
    metadata.push(`--allow-fs-read=${join(directory,'.git')}`);if(directory===dirname(directory))break;
  }
  run(process.execPath,[...metadata,join(consumer,'runtime.mjs')],consumer,{NODE_OPTIONS:scoped+' --allow-child-process'});
  writeFileSync(join(consumer,'capture.mjs'),`import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
const entry=import.meta.resolve('pi-decision-tools/extension');
const {FileEvidenceCapturer}=await import(new URL('./filesystem/capture.js',entry));
const {RetainedMemory}=await import(new URL('./core/memory.js',entry));
const root=join(process.cwd(),'capture-fixture');mkdirSync(root);writeFileSync(join(root,'safe.txt'),'synthetic captured evidence');writeFileSync(join(root,'.env'),'not captured');
const memory=new RetainedMemory(),capturer=new FileEvidenceCapturer(root,memory),scope=await capturer.capture({paths:['safe.txt','.env']});
assert.equal(scope.summary().scopeComplete,true);assert.equal(scope.summary().files.excluded,1);assert.equal(scope.summary().exclusions[0].reason,'sensitive');
const evidence=scope.evidence()[0];assert.equal(evidence.verification,'captured');assert.equal(scope.text(evidence.evidenceId),'synthetic captured evidence');
assert.equal(await scope.freshness(evidence.evidenceId),'unchanged');unlinkSync(join(root,'safe.txt'));assert.equal(await scope.freshness(evidence.evidenceId),'missing');
scope.release();assert.equal(memory.retainedBytes,0);assert.equal(memory.reservedBytes,0);
console.log('installed internal file capture, exclusions, freshness and shared-memory release verified');`);
  run(process.execPath,[...metadata,join(consumer,'capture.mjs')],consumer,{NODE_OPTIONS:scoped+' --allow-child-process'});
  writeFileSync(join(consumer,'types.mts'),`import extension from 'pi-decision-tools/extension';
import {connect,protocolVersion,type Client,type Submit,type ExecutionResult} from 'pi-decision-tools';
import type {ExtensionAPI,ExtensionContext,ExtensionFactory} from '@earendil-works/pi-coding-agent';
declare const pi:ExtensionAPI;declare const ctx:ExtensionContext;
const factory:ExtensionFactory=extension;const protocol:1=protocolVersion;const client:Client=connect(pi,ctx);
const input:Submit={items:[{id:'synthetic',inputVersion:'1',state:{text:'synthetic'}}],rubricVersion:'1',questions:{q:{type:'bool',instructions:'Fixture?',criteria:{true:'yes',false:'no'}}}};
const pending:Promise<ExecutionResult>=client.submit(input);void pending;void factory;void protocol;`);
  run(process.execPath,[join(root,'node_modules','typescript','lib','tsc.js'),'--noEmit','--strict','--exactOptionalPropertyTypes','--skipLibCheck','--module','NodeNext','--moduleResolution','NodeNext','--target','ES2022',join(consumer,'types.mts')],consumer,{NODE_OPTIONS:scoped});
  console.log(JSON.stringify({status:'passed',artifact:pack.filename,integrity:pack.integrity,files:names.length,unpackedBytes:pack.unpackedSize,
    installedOffline:true,internalCapture:'installed file capture/exclusions/freshness/release verified; no public filesystem export',hostPeers:'linked from verified local host; not bundled',libraryImport:'inert',exports:'ESM and TypeScript checked',piRegistration:'eight tools; four family configurations; disabled enforcement; fake record and public systematic/discovery search preparation/execution/yields/continuation/views/evidence/release and generic regression',publication:'not attempted'},null,2));
}finally{rmSync(temporary,{recursive:true,force:true});}
