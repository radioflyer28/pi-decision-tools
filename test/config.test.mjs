import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { UserConfiguration, defaultConfiguration } from '../dist/pi/config.js';
import { temporaryFixture } from './helpers/fixtures.mjs';

test('EX-38 absent config has experimental defaults, no authorization and no implicit write',t=>{
  const f=temporaryFixture(t),store=new UserConfiguration(f.root);
  assert.deepEqual(store.load(),defaultConfiguration());
  assert.equal(existsSync(store.path),false);assert.equal(store.load().enabled,undefined);
});

test('EX-38 malformed, unknown-version, and enabled-state configuration fail rather than reset',t=>{
  const f=temporaryFixture(t),store=new UserConfiguration(f.root);
  for(const content of ['{',JSON.stringify({...defaultConfiguration(),version:2}),
    JSON.stringify({...defaultConfiguration(),enabled:true}),JSON.stringify({...defaultConfiguration(),limits:{}})]){
    writeFileSync(store.path,content);
    assert.throws(()=>store.load(),{code:'invalid_configuration'});
    assert.throws(()=>store.saveDefault({provider:'fake',id:'new'}),{code:'invalid_configuration'});
    assert.equal(readFileSync(store.path,'utf8'),content);
  }
});

test('EX-38 explicit default saving atomically preserves families and limits without enabling',t=>{
  const f=temporaryFixture(t),store=new UserConfiguration(f.root);
  const original={...defaultConfiguration(),families:{generic:false,semantic:true}};
  writeFileSync(store.path,JSON.stringify(original));
  const saved=store.saveDefault({provider:'fake',id:'model/with/slashes'});
  assert.deepEqual(store.load(),{...original,defaultModel:{provider:'fake',id:'model/with/slashes'}});
  assert.equal(saved.enabled,undefined);
  assert.equal(readdirSync(f.root).some(name=>name.endsWith('.tmp')),false);
});

test('EX-38 write/rename failures retain old bytes and remove temporary files',t=>{
  for(const phase of ['write','rename']){
    const f=temporaryFixture(t),original=JSON.stringify({...defaultConfiguration(),defaultModel:{provider:'fake',id:'old'}});
    const store=new UserConfiguration(f.root,{
      read:path=>readFileSync(path,'utf8'),mkdir:path=>mkdirSync(path,{recursive:true}),
      write(path,text){if(phase==='write')throw new Error('PRIVATE');writeFileSync(path,text,{flag:'wx'});},
      rename(from,to){if(phase==='rename')throw new Error('PRIVATE');renameSync(from,to);},unlink:unlinkSync,
    });
    writeFileSync(store.path,original);
    assert.throws(()=>store.saveDefault({provider:'fake',id:'new'}),{code:'configuration_write_error',message:'configuration_write_error'});
    assert.equal(readFileSync(store.path,'utf8'),original);
    assert.equal(readdirSync(f.root).some(name=>name.endsWith('.tmp')),false);
  }
});

test('EX-38 permission failures are not treated as absent configuration',t=>{
  const f=temporaryFixture(t);
  const store=new UserConfiguration(f.root,{read(){throw Object.assign(new Error('PRIVATE'),{code:'EACCES'});}});
  assert.throws(()=>store.load(),{code:'configuration_read_error'});
});
