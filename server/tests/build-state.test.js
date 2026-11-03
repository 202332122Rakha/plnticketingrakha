import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {recordBuild,checkBuild} from '../../scripts/build-state.mjs';
async function project(run){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ticketing-build-'));try{await fs.mkdir(path.join(dir,'src'));await fs.mkdir(path.join(dir,'dist'));await fs.writeFile(path.join(dir,'package.json'),'{}');await fs.writeFile(path.join(dir,'src','main.ts'),'export const value=1;');await fs.writeFile(path.join(dir,'dist','index.html'),'<html>built</html>');await run(dir);}finally{await fs.rm(dir,{recursive:true,force:true});}}
test('a build receipt matches untouched source and compiled files',()=>project(async dir=>{await recordBuild(dir);assert.equal((await checkBuild(dir)).valid,true);}));
test('source editing invalidates an old build',()=>project(async dir=>{await recordBuild(dir);await fs.writeFile(path.join(dir,'src','main.ts'),'changed');assert.equal((await checkBuild(dir)).valid,false);}));
test('missing or changed output cannot be launched as a verified build',()=>project(async dir=>{await recordBuild(dir);await fs.unlink(path.join(dir,'dist','index.html'));assert.equal((await checkBuild(dir)).valid,false);}));
test('credential changes never enter the source receipt and need no frontend rebuild',()=>project(async dir=>{await recordBuild(dir);await fs.writeFile(path.join(dir,'.env'),'DB_PASSWORD=not-in-receipt');assert.equal((await checkBuild(dir)).valid,true);assert.equal((await fs.readFile(path.join(dir,'.build-state.json'),'utf8')).includes('not-in-receipt'),false);}));
test('a missing installed runtime dependency prevents issuing a ready build receipt',()=>project(async dir=>{await fs.writeFile(path.join(dir,'package.json'),JSON.stringify({dependencies:{pg:'8.16.3'}}));await assert.rejects(recordBuild(dir),/pg/);}));
