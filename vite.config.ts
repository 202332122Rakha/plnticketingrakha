import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {defineConfig, loadEnv} from 'vite';
export default defineConfig(({mode})=>{
  const env=loadEnv(mode,process.cwd(),'');
  const port=Number(process.env.PORT||env.PORT||4000);
  if(!Number.isInteger(port)||port<1||port>65535) throw new Error('PORT backend tidak valid.');
  return {
    plugins:[react(),tailwindcss()],
    resolve:{alias:{'@':path.resolve(process.cwd(),'.')}},
    server:{host:'127.0.0.1',port:3000,strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${port}`,changeOrigin:true}},
      hmr:process.env.DISABLE_HMR!=='true',watch:process.env.DISABLE_HMR==='true'?null:{}},
    preview:{host:'127.0.0.1',port:4173,proxy:{'/api':{target:`http://127.0.0.1:${port}`,changeOrigin:true}}},
  };
});
