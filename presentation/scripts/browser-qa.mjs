// Run against an extracted ZIP with BUSCAG_TEST_PACKAGE_DIR; never rebuild that package.
import {mkdtemp,rm,mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.BUSCAG_PLAYWRIGHT_MODULE||'@playwright/test');
const root=process.env.BUSCAG_TEST_PACKAGE_DIR||resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {createApp}=await import(pathToFileURL(join(root,'server/index.mjs')).href);
const dataDir=await mkdtemp(join(tmpdir(),'buscag-browser-'));
const password='synthetic-browser-password-2026';
const server=await createApp({dataDir,password});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}:{} )});
 const publicContext=await browser.newContext({viewport:{width:1920,height:1080}}),privateContext=await browser.newContext({viewport:{width:1920,height:1080}});
 const page=await publicContext.newPage(),presenter=await privateContext.newPage();const errors=[],bad=[];
 for(const p of [page,presenter]){p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&/\/(assets|brand|captures|sounds|media)\//.test(r.url()))bad.push({url:r.url(),status:r.status()});});}
 await page.goto(origin);await page.getByRole('button',{name:'Entrar en presentación'}).click();await page.locator('.slide h1').waitFor({state:'visible'});
 assert.ok((await page.locator('.slide h1').textContent()).includes('Cuánto tardarías'));
 await presenter.goto(origin+'/presenter');await presenter.getByLabel('Contraseña',{exact:true}).fill(password);await presenter.getByRole('button',{name:'Ingresar'}).click();await presenter.locator('.presenter-grid').waitFor();
 await presenter.getByRole('button',{name:'Siguiente',exact:false}).click();await page.getByRole('heading',{name:'BuscAG. Encontrarnos hace la diferencia.',exact:true}).waitFor();
 await presenter.goto(origin+'/studio');await presenter.locator('.studio-header').waitFor();assert.equal(await presenter.locator('.scene-item').count(),24);
 await presenter.getByRole('button',{name:'Duplicar',exact:true}).click();assert.equal(await presenter.locator('.scene-item').count(),25);await presenter.getByTitle('Deshacer',{exact:true}).click();assert.equal(await presenter.locator('.scene-item').count(),24);
 await presenter.getByRole('button',{name:'Guardar',exact:true}).click();await presenter.getByRole('status').filter({hasText:'Guardado en servidor'}).waitFor();
 const audio=await page.evaluate(()=>new Promise((resolve,reject)=>{const a=new Audio('/sounds/connection.wav');a.onloadedmetadata=()=>resolve({duration:a.duration});a.onerror=()=>reject(Error('No se decodificó WAV'));a.load();}));assert.ok(Math.abs(audio.duration-3)<.05);
 assert.equal((await publicContext.request.get(origin+'/api/admin/project')).status(),401);
 const publicProject=await(await publicContext.request.get(origin+'/api/project')).json();assert.ok(publicProject.scenes.every(s=>s.script===undefined&&s.actions===undefined));
 assert.equal((await publicContext.request.get(origin+'/data/auth.json')).status(),404);
 for(const path of ['/assets/no-existe.css','/src/seed.json','/server/index.mjs'])assert.equal((await publicContext.request.get(origin+path)).status(),404);
 assert.deepEqual(errors,[],'errores JavaScript');assert.deepEqual(bad,[],'recursos bloqueados');
 if(process.env.BUSCAG_SCREENSHOT_DIR){await mkdir(process.env.BUSCAG_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.BUSCAG_SCREENSHOT_DIR,'presentacion-1080p.png')});await presenter.screenshot({path:join(process.env.BUSCAG_SCREENSHOT_DIR,'studio-1080p.png')});}
 console.log('Chromium 1920x1080: presentación y avance SSE, login/presentador, Studio/guardar/undo, WAV y controles de privacidad OK. Sin errores JS ni assets 403. Paquete: '+root);
}finally{await browser?.close();await new Promise(r=>server.close(r));await rm(dataDir,{recursive:true,force:true});}
