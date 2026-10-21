// Never run automatically. Only the explicit CLI gate below authorizes a live call.
import { parseLimits, jsonBytes } from '../dist/core/validation.js';
const payload={items:[{id:'synthetic-smoke',inputVersion:'1',state:{text:'Synthetic smoke fixture: the sky is blue.'}}],
  rubricVersion:'smoke-v1',questions:{blue:{type:'bool',instructions:'Does the supplied sentence say the sky is blue?',criteria:{true:'It says the sky is blue.',false:'It does not say the sky is blue.'}}},run:{maxRequests:1}};
function parameters(args){
  if(!args.includes('--authorize-live'))throw new Error('authorization_required');
  const values=new Map();
  for(let i=0;i<args.length;i++){
    const key=args[i];if(values.has(key))throw new Error('invalid_arguments');
    if(key==='--authorize-live'){values.set(key,true);continue;}
    if(!['--model','--budget'].includes(key)||!args[i+1])throw new Error('invalid_arguments');
    values.set(key,args[++i]);
  }
  const model=values.get('--model'),budget=values.get('--budget');
  if(typeof model!=='string'||typeof budget!=='string')throw new Error('model_and_budget_required');
  const slash=model.indexOf('/');if(slash<1||slash===model.length-1)throw new Error('exact_model_required');
  let limits;try{limits=parseLimits(JSON.parse(budget));}catch{throw new Error('invalid_budget');}
  if(limits.requests!==1||limits.concurrency!==1||limits.maxRetries!==0||
    limits.inputBytes<jsonBytes({state:payload.items[0].state,questions:payload.questions}))throw new Error('smoke_requires_one_request_no_retries');
  return {model:{provider:model.slice(0,slash),id:model.slice(slash+1)},limits};
}
let options;
try{options=parameters(process.argv.slice(2));}
catch(error){console.log(JSON.stringify({status:'not_run',reason:error.message,syntheticInput:payload}));process.exitCode=2;}
if(options){
  let directory;
  try{
    const {mkdtempSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
    const {ModelRuntime,SessionManager}=await import('@earendil-works/pi-coding-agent');
    const {ClassifierAdapter}=await import('../dist/pi/classifier-adapter.js');
    const {SessionLedger}=await import('../dist/pi/session-adapter.js');
    const {ExecutionControls}=await import('../dist/core/controls.js');
    const {Coordinator}=await import('../dist/core/coordinator.js');
    const runtime=await ModelRuntime.create({refreshOnCreate:false,allowModelNetwork:false});
    const adapter=new ClassifierAdapter({getAvailableOfType:type=>runtime.getAvailableOfType(type,options.model.provider),
      classify:(...args)=>runtime.classify(...args)});
    await adapter.refresh();
    if(!adapter.available().some(m=>m.provider===options.model.provider&&m.id===options.model.id)){
      console.log(JSON.stringify({status:'not_run',reason:'model_unavailable_or_missing_credentials'}));process.exitCode=2;
    }else{
      directory=mkdtempSync(join(tmpdir(),'pi-decision-live-smoke-'));
      const session=SessionManager.create(directory,directory);
      session.appendMessage({role:'user',content:'Operator-authorized synthetic Pi Decision Tools smoke test.',timestamp:Date.now()});
      const ledger=new SessionLedger(session,(type,data)=>session.appendCustomEntry(type,data));
      const controls=new ExecutionControls(ledger,adapter.available,{version:1,families:{generic:true,semantic:false},limits:options.limits});
      controls.enable(options.model,options.limits);const coordinator=new Coordinator(controls,adapter);
      const result=await coordinator.submit(payload,'library');await coordinator.expire();
      const page=result.data.ok?result.data.value:result.data.batch;
      const success=result.data.ok&&page.counts.completed===1;
      console.log(JSON.stringify({status:success?'executed':'execution_failed',sessionFile:session.getSessionFile(),result}));
      if(!success)process.exitCode=1;
    }
  }catch{console.log(JSON.stringify({status:'failed',reason:'smoke_setup_or_execution_error',sessionDirectory:directory??null}));process.exitCode=1;}
}
