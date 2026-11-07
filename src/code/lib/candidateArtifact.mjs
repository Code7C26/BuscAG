// Local artifact integrity only. No network, deployment or approval of services.
import {readdir,readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {PRESENTATION_APP_URL} from './presentationEnvironment.mjs';
import {STAGING_REF} from './stagingEnvironment.mjs';
export async function inventoryCandidate(directory,relative=''){
 if(!(await lstat(directory)).isDirectory())throw Error('El artefacto debe ser un directorio real.');
 const files=[];
 for(const entry of await readdir(join(directory,relative),{withFileTypes:true})){
  const name=relative+entry.name;
  if(name==='presentation-manifest.json')continue;
  if(entry.isDirectory())files.push(...await inventoryCandidate(directory,name+'/'));
  else if(entry.isFile()){
   const bytes=await readFile(join(directory,name));
   files.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }else throw Error('El artefacto no admite enlaces ni archivos especiales.');
 }
 return files.sort((a,b)=>a.path.localeCompare(b.path));
}
export async function verifyCandidate(directory,{commit,version}){
 const manifest=JSON.parse(await readFile(join(directory,'presentation-manifest.json'),'utf8'));
 if(manifest.release_candidate!==true||manifest.version!==version||manifest.commit!==commit||
  manifest.mode!=='presentation'||manifest.project_ref!==STAGING_REF||manifest.app_origin!==PRESENTATION_APP_URL||
  manifest.approval!=='REQUIRES_LIVE_REHEARSAL_AND_DEPLOY_AUTHORIZATION')throw Error('El manifiesto no corresponde a la candidata, commit y destino esperados.');
 const observed=await inventoryCandidate(directory);
 if(!observed.some(file=>file.path==='index.html')||JSON.stringify(observed)!==JSON.stringify(manifest.files))throw Error('El contenido del artefacto cambió o está incompleto. Volvé a compilar la candidata.');
 return {version,commit,project_ref:STAGING_REF,app_origin:PRESENTATION_APP_URL,files:observed.length,approval:manifest.approval};
}
