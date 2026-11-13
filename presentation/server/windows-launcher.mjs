import {createApp} from './index.mjs';
import {existsSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const host='127.0.0.1',port=4173,url=`http://${host}:${port}`;
if(!existsSync(join(root,'dist','index.html'))){console.error('Falta dist/index.html. Usa el ZIP portable o PREPARAR-DESDE-FUENTE.cmd.');process.exit(1);}
const server=await createApp({dataDir:join(root,'data')});
server.once('error',error=>{
 console.error(error.code==='EADDRINUSE'?'El puerto 4173 esta ocupado. Cierra el iniciador anterior o la aplicacion que usa ese puerto y reintenta.':`No se pudo iniciar: ${error.code||error.message}`);
 server.close(()=>process.exit(1));
});
server.listen(port,host,()=>{
 console.log(`\nPRESENTACION: ${url}/\nPRESENTADOR:  ${url}/presenter\nSTUDIO:       ${url}/studio`);
 console.log('\nMantene esta ventana abierta. Para terminar, presiona Ctrl+C.');
 if(process.platform==='win32'){
  const paths=[process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean).map(base=>join(base,'Google','Chrome','Application','chrome.exe'));
  const chrome=paths.find(existsSync);
  if(chrome){const child=spawn(chrome,['--new-window',url],{detached:true,stdio:'ignore'});child.on('error',()=>console.log(`Abri Chrome y visita ${url}/`));child.unref();}
  else console.log(`Chrome no se encontro en las ubicaciones habituales. Abrilo manualmente y visita ${url}/`);
 }
});
let stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{if(stopping)return;stopping=true;server.close(()=>process.exit(0));});
