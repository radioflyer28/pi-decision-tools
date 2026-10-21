import {SessionManager} from '../../node_modules/@earendil-works/pi-coding-agent/dist/core/session-manager.js';
import {Coordinator} from '../../dist/core/coordinator.js';
import {ExecutionControls} from '../../dist/core/controls.js';
import {DEFAULT_LIMITS} from '../../dist/core/validation.js';
import {ClassifierAdapter} from '../../dist/pi/classifier-adapter.js';
import {SessionLedger} from '../../dist/pi/session-adapter.js';
import {SemanticExecution} from '../../dist/semantic/execution.js';
import {SemanticResults} from '../../dist/semantic/results.js';
import {temporaryFixture,FakeClassifier} from './fixtures.mjs';
export const searchModel={type:'classifier',provider:'fake',id:'fixture',name:'Fixture',api:'fake',baseUrl:'https://fixture.invalid',input:['text'],contextWindow:10000,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}};
export async function searchFixture(t,{exclusions=[],hooks,limits={},conversation=true,enabled=true,families={generic:true,semantic:true},actions=[],clock}={}){
  const f=temporaryFixture(t),session=SessionManager.create(f.root,f.sessions);
  if(conversation)session.appendMessage({role:'user',content:'Synthetic search fixture',timestamp:0});
  const ledger=new SessionLedger(session,(type,data)=>session.appendCustomEntry(type,data)),fake=new FakeClassifier(...actions),models=[{...searchModel}];
  const classifier=new ClassifierAdapter({getAvailableOfType:async()=>models,classify:fake.classify});await classifier.refresh();
  const controls=new ExecutionControls(ledger,classifier.available,{version:1,families,limits:{...DEFAULT_LIMITS,...limits}});
  const core=new Coordinator(controls,classifier,clock);if(enabled)controls.enable();
  const engine=new SemanticExecution(core,clock,{root:f.root,fileExclusions:exclusions,hooks}),results=new SemanticResults(engine.parents);
  t.after(async()=>{await engine.expire();await core.expire();});return {f,core,engine,results,fake,ledger,controls,models,classifier,session};
}
