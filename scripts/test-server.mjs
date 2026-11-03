import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const files=(await readdir('server/tests')).filter(name=>name.endsWith('.test.js')).sort().map(name=>`server/tests/${name}`);
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});process.exitCode=result.status??1;
