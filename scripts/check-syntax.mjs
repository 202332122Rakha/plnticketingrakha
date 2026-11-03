import {readdir} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
let count=0;
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()) await walk(file);else if(/\.m?js$/.test(file)){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0){process.stderr.write(result.stderr);process.exit(1);}count++;}}}
await walk('server');await walk('scripts');console.log(`Syntax checks passed: ${count} JavaScript files.`);
