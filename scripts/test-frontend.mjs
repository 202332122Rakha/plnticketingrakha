import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=process.cwd();
const ts=await import(process.env.TEST_TYPESCRIPT_MODULE ? pathToFileURL(process.env.TEST_TYPESCRIPT_MODULE).href : 'typescript');
const compile=ts.default||ts;
const out=await fs.mkdtemp(path.join(root,'.frontend-test-'));
async function walk(dir) {
  for(const entry of await fs.readdir(dir,{withFileTypes:true})) {
    const source=path.join(dir,entry.name);
    if(entry.isDirectory()) {await walk(source);continue;}
    if(!/\.tsx?$/.test(source)) continue;
    let code=compile.transpileModule(await fs.readFile(source,'utf8'),{compilerOptions:{target:compile.ScriptTarget.ES2022,module:compile.ModuleKind.ES2022,jsx:compile.JsxEmit.ReactJSX}}).outputText;
    code=code.replace(/(from\s+|import\s*\()(['"])(\.[^'"]+)\2/g,(full,pre,q,spec)=>{
      const candidate=path.resolve(path.dirname(source),spec);
      const isDir=spec.endsWith('/types')||spec.endsWith('/types/');
      return `${pre}${q}${spec}${isDir?'/index.js':/\.[a-z]+$/.test(spec)?'':'.js'}${q}`;
    });
    const dest=path.join(out,path.relative(root,source).replace(/\.tsx?$/,'.js'));await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,code);
  }
}
try {
 await walk(path.join(root,'src'));await fs.writeFile(path.join(out,'package.json'),'{"type":"module"}');
 const result=spawnSync(process.execPath,['--test','tests/frontend.test.mjs'],{stdio:'inherit',env:{...process.env,TEST_COMPILED_ROOT:out}});
 process.exitCode=result.status??1;
} finally {await fs.rm(out,{recursive:true,force:true});}
