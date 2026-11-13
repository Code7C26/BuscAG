import {test} from 'node:test';
import assert from 'node:assert/strict';
import {win32,posix} from 'node:path';
import {mkdtemp,rm,readFile,writeFile,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createApp} from '../server/index.mjs';
import {isInsideDirectory,resolvePublicPath} from '../server/static-paths.mjs';

test('regresión Windows: HTML y todos los assets legítimos permanecen dentro de dist',()=>{
 for(const [paths,base] of [[win32,'C:\\Users\\Germán\\Mi presentación\\dist'],[win32,'\\\\equipo\\presentación\\dist'],[posix,'/tmp/Mi presentación/dist']]){
  for(const url of ['/','/assets/index-CK6Uas75.js','/assets/motion-BSdLxqQx.js','/assets/archive-g7iHT04s.js','/assets/index-CzElVrUz.css','/brand/icon.svg','/brand/manrope.woff2','/sounds/connection.wav']){
   const file=resolvePublicPath(base,url,paths);assert.ok(isInsideDirectory(base,file,paths),url);
   if(paths===win32&&url!=='/')assert.equal(file.startsWith(base+'/'),false,'reproduce exactamente el 403 de la implementación anterior');
  }
  assert.equal(isInsideDirectory(base,paths.resolve(base,'..','dist-private','secret.json'),paths),false);
  assert.equal(isInsideDirectory(base,paths.resolve(base,'..','data','auth.json'),paths),false);
  for(const url of ['/%2e%2e%2fdata/auth.json','/%2e%2e%5cdata%5cauth.json','//otro-equipo/share/file','/.env','/%00file'])assert.throws(()=>resolvePublicPath(base,url,paths));
 }
 assert.equal(isInsideDirectory('C:\\dist','D:\\dist\\index.html',win32),false);
});

test('HTTP real: assets del build, MIME, rutas SPA y aislamiento de datos privados',async()=>{
 const data=await mkdtemp(join(tmpdir(),'buscag-static-'));
 const server=await createApp({dataDir:data,password:'synthetic-private-test-password'});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  const assets=[...new Set(html.match(/\/assets\/[^" ]+\.(?:js|css)/g))];assert.ok(assets.length>=4,'prueba todos los chunks reales del ZIP');
  const resources=[...assets.map(path=>[path,path.endsWith('.css')?'text/css':'text/javascript']),['/brand/icon.svg','image/svg+xml'],['/brand/manrope.woff2','font/woff2'],['/sounds/connection.wav','audio/wav'],['/captures/home-desktop.png','image/png'],['/docs/Informe.pdf','application/pdf']];
  for(const [path,mime]of resources){const r=await fetch(origin+path);assert.equal(r.status,200,path);assert.equal(r.headers.get('content-type')?.split(';')[0],mime,path);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.ok((await r.arrayBuffer()).byteLength>0);const head=await fetch(origin+path,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-type')?.split(';')[0],mime);assert.equal((await head.arrayBuffer()).byteLength,0);}
  for(const route of ['/','/presenter','/studio','/admin','/vote']){const r=await fetch(origin+route);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/^text\/html/);assert.equal(await r.text(),html);}
  for(const route of ['/assets/no-existe.css','/data/auth.json','/server/index.mjs','/src/seed.json'])assert.equal((await fetch(origin+route)).status,404,route);
  for(const route of ['/api/admin/project','/api/admin/state','/api/admin/original'])assert.equal((await fetch(origin+route)).status,401,route);
  assert.equal((await fetch(origin+'/%2e%2e%2fdata/auth.json')).status,403);
  assert.equal((await fetch(origin+'/%2e%2e%5cdata%5cauth.json')).status,403);
  assert.equal((await fetch(origin+'/%E0%A4%A')).status,400);
  assert.equal((await fetch(origin+'/assets/index.js',{method:'POST'})).status,405);
  const publicProject=await(await fetch(origin+'/api/project')).json();assert.ok(publicProject.scenes.every(s=>s.script===undefined&&s.actions===undefined));
 }finally{await new Promise(r=>server.close(r));await rm(data,{recursive:true,force:true});}
});

test('un symlink fuera del directorio público no expone archivos privados',async t=>{
 const target=new URL('../dist/escape-test.json',import.meta.url);const dir=await mkdtemp(join(tmpdir(),'buscag-symlink-'));const outside=join(dir,'private.json');await writeFile(outside,'{"private":"synthetic"}');
 try{await symlink(outside,target);}catch(e){await rm(dir,{recursive:true,force:true});if(e.code==='EPERM'){t.skip('Windows sin privilegio de creación de symlinks');return;}throw e;}
 const server=await createApp({dataDir:join(dir,'data')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{assert.equal((await fetch('http://127.0.0.1:'+server.address().port+'/escape-test.json')).status,403);}finally{await new Promise(r=>server.close(r));await rm(target,{force:true});await rm(dir,{recursive:true,force:true});}
});
