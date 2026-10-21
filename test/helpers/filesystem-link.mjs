// Narrow fixture-only process: no source reads and no arbitrary filesystem target.
import assert from 'node:assert/strict';
import {relative,isAbsolute} from 'node:path';
import {symlinkSync} from 'node:fs';
const [target,path,type]=process.argv.slice(2),root=process.env.TEST_TEMP_ROOT;
assert.ok(root);assert.ok(['file','dir','junction'].includes(type));
for(const value of [target,path]){assert.equal(typeof value,'string');const rel=relative(root,value);assert.ok(rel&&!rel.startsWith('..')&&!isAbsolute(rel));}
symlinkSync(target,path,type);
