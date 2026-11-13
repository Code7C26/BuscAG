// Serve the real compiled staging client. No dev optimizer/HMR, remote calls or deploy.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {stagingEnvironment} from '../lib/stagingEnvironment.mjs';
const vite=fileURLToPath(new URL('../node_modules/vite/bin/vite.js',import.meta.url));
const env={...Object.fromEntries(Object.entries(process.env).filter(([name])=>!name.startsWith('VITE_'))),...stagingEnvironment('sb_publishable_e2e_fixture')};
delete env.BUSCAG_STAGING_DATABASE_URL;
const build=spawn(process.execPath,[vite,'build','--mode','staging','--outDir','dist-e2e'],{cwd:new URL('..',import.meta.url),env,stdio:'inherit',shell:false});
let preview;
const stop=signal=>{build.kill(signal);preview?.kill(signal);};
process.on('SIGTERM',()=>stop('SIGTERM'));process.on('SIGINT',()=>stop('SIGINT'));
build.on('error',()=>{process.exitCode=1;});
build.on('exit',code=>{
 if(code!==0){process.exitCode=code??1;return;}
 preview=spawn(process.execPath,[vite,'preview','--mode','staging','--outDir','dist-e2e','--host','127.0.0.1','--port','3001','--strictPort'],{cwd:new URL('..',import.meta.url),env,stdio:'inherit',shell:false});
 preview.on('error',()=>{process.exitCode=1;});preview.on('exit',code=>{process.exitCode=code??1;});
});
