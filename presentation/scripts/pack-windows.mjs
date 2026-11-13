import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(process.env.BUSCAG_PACKAGE_OUTPUT||join(root,'descargas'));
const zip=new JSZip();const folder=zip.folder('BuscAG-presentation');
const excluded=new Set(['node_modules','data','.git','dist-e2e','descargas','test-results','playwright-report','__pycache__']);
async function walk(dir,prefix=''){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  if(excluded.has(entry.name)||entry.name.startsWith('.env')||entry.name.endsWith('.log'))continue;
  const rel=prefix?prefix+'/'+entry.name:entry.name;
  if(entry.isDirectory())await walk(join(dir,entry.name),rel);
  else if(entry.isFile())folder.file(rel,await readFile(join(dir,entry.name)));
  // Symlinks are never packaged, including local dependency shortcuts.
 }
}
await readFile(join(root,'dist','index.html'));await walk(root);
const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});
const check=await JSZip.loadAsync(bytes,{checkCRC32:true});
for(const file of ['dist/index.html','server/index.mjs','server/static-paths.mjs','INICIAR-WINDOWS.cmd','LEEME-WINDOWS.md'])if(!check.file('BuscAG-presentation/'+file))throw Error('Falta '+file);
await mkdir(output,{recursive:true});await writeFile(join(output,'BuscAG-Windows-completo.zip'),bytes);await writeFile(join(output,'SHA256.txt'),createHash('sha256').update(bytes).digest('hex')+'  BuscAG-Windows-completo.zip\n');console.log('ZIP verificado: '+join(output,'BuscAG-Windows-completo.zip')+' ('+bytes.length+' bytes)');
