// Official Google ADC; Hosting GETs only. Never reads firebase-tools credentials.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export const HOSTING_PROJECT='buscag-2677c',HOSTING_SITE='buscag-prueba';
export const READ_SCOPE='https://www.googleapis.com/auth/cloud-platform.read-only';
const base='https://firebasehosting.googleapis.com/v1beta1/';
const start=Date.parse('2026-11-06T03:00:00Z'),end=Date.parse('2026-11-07T03:00:00Z');
const prefix='(?:projects/(?:buscag-2677c|[0-9]+)/)?sites/buscag-prueba/';
const releaseName=new RegExp('^'+prefix+'releases/([A-Za-z0-9_-]{1,200})$');
const versionName=new RegExp('^'+prefix+'versions/[A-Za-z0-9_-]{1,200}$');
const statuses=new Set(['VERSION_STATUS_UNSPECIFIED','CREATED','FINALIZED','DELETED','ABANDONED','EXPIRED','CLONING']);
export class HostingReadError extends Error{constructor(code){super(code);this.code=code;}}
export function publicHostingError(error){
 const messages={
  ADC_UNAVAILABLE:'BUSCAG_HOSTING_ADC: Configurá ADC con gcloud auth application-default login. firebase login no configura ADC. No compartas credenciales.',
  INVALID_ARGUMENTS:'BUSCAG_HOSTING_USAGE: Ejecutar node scripts/list-hosting-releases.mjs sin argumentos; destino y fecha están fijados.',
  UNEXPECTED_RESPONSE:'BUSCAG_HOSTING_RESPONSE: Respuesta incompleta o de otro sitio. No se imprimió una lista parcial.',
  PAGINATION_FAILED:'BUSCAG_HOSTING_PAGINATION: Paginación repetida o excesiva. No se imprimió una lista parcial.',
 };
 if(error instanceof HostingReadError)return messages[error.code]??'BUSCAG_HOSTING_READ_FAILED: No se pudo completar la consulta de sólo lectura.';
 const status=Number(error?.response?.status??error?.status);
 if(status===401)return 'BUSCAG_HOSTING_401: ADC ausente, vencida o revocada. Repetí gcloud auth application-default login con la cuenta correcta.';
 if(status===403)return 'BUSCAG_HOSTING_403: Revisar cuenta ADC, permisos de lectura de Hosting y proyecto de cuota/API. No es necesario desplegar ni ampliar a administrador.';
 if(status===404)return 'BUSCAG_HOSTING_404: El sitio no está disponible bajo buscag-2677c o la cuenta no puede consultarlo. Confirmar proyecto/sitio.';
 return 'BUSCAG_HOSTING_READ_FAILED: Revisar red, TLS y ADC. No se muestran errores HTTP crudos porque pueden contener credenciales.';
}
export function releaseForRequestedDay(raw){
 if(!raw||typeof raw.releaseTime!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(raw.releaseTime))throw new HostingReadError('UNEXPECTED_RESPONSE');
 const instant=Date.parse(raw.releaseTime);
 if(!Number.isFinite(instant))throw new HostingReadError('UNEXPECTED_RESPONSE');
 if(instant<start||instant>=end)return null;
 const name=typeof raw.name==='string'?releaseName.exec(raw.name):null;
 if(!name)throw new HostingReadError('UNEXPECTED_RESPONSE');
 let version=null,status;
 if(raw.type==='SITE_DISABLE'&&!raw.version){status='SITE_DISABLE';}
 else{
  if(!raw.version||!versionName.test(raw.version.name??''))throw new HostingReadError('UNEXPECTED_RESPONSE');
  version=raw.version.name;status=raw.version.status??'VERSION_STATUS_UNSPECIFIED';
  if(!statuses.has(status))throw new HostingReadError('UNEXPECTED_RESPONSE');
 }
 // Exactly four output fields. Keep API timestamp precision/offset unchanged.
 return {release_id:name[1],'version.name':version,fecha_hora:raw.releaseTime,estado:status};
}
export async function listHostingReleases(client){
 const get=async url=>{
  if(url.origin!=='https://firebasehosting.googleapis.com'||!url.pathname.startsWith('/v1beta1/'))throw new HostingReadError('UNEXPECTED_RESPONSE');
  const response=await client.request({url:url.href,method:'GET',responseType:'json',timeout:20000,retry:false,maxRedirects:0});
  if(!response?.data||typeof response.data!=='object'||Array.isArray(response.data))throw new HostingReadError('UNEXPECTED_RESPONSE');
  return response.data;
 };
 // Bind the globally unique site to the requested project before listing history.
 const siteUrl=new URL(`projects/${HOSTING_PROJECT}/sites/${HOSTING_SITE}`,base);siteUrl.searchParams.set('fields','name');
 const site=await get(siteUrl);
 if(!/^projects\/(?:buscag-2677c|[0-9]+)\/sites\/buscag-prueba$/.test(site.name??''))throw new HostingReadError('UNEXPECTED_RESPONSE');
 const all=[],seenPages=new Set(),seenReleases=new Set();let token;
 for(let page=0;page<1000;page++){
  const url=new URL(`sites/${HOSTING_SITE}/releases`,base);
  url.searchParams.set('pageSize','100');
  // Do not even request releaseUser, emails, labels, config or message.
  url.searchParams.set('fields','releases(name,releaseTime,type,version(name,status)),nextPageToken');
  if(token)url.searchParams.set('pageToken',token);
  const data=await get(url);
  if(data.releases!==undefined&&!Array.isArray(data.releases))throw new HostingReadError('UNEXPECTED_RESPONSE');
  for(const raw of data.releases??[]){
   const row=releaseForRequestedDay(raw);if(!row)continue;
   if(seenReleases.has(row.release_id))throw new HostingReadError('PAGINATION_FAILED');
   seenReleases.add(row.release_id);all.push(row);
  }
  const next=data.nextPageToken;
  if(next===undefined||next==='')return all.sort((a,b)=>Date.parse(a.fecha_hora)-Date.parse(b.fecha_hora)||a.release_id.localeCompare(b.release_id));
  if(typeof next!=='string'||next.length>4096||seenPages.has(next))throw new HostingReadError('PAGINATION_FAILED');
  seenPages.add(next);token=next;
 }
 throw new HostingReadError('PAGINATION_FAILED');
}
export async function adcHostingClient(){
 try{
  const {GoogleAuth}=await import('google-auth-library');
  return await new GoogleAuth({scopes:[READ_SCOPE]}).getClient();
 }catch{throw new HostingReadError('ADC_UNAVAILABLE');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(process.argv.length!==2)throw new HostingReadError('INVALID_ARGUMENTS');
  const rows=await listHostingReleases(await adcHostingClient());
  console.log(JSON.stringify(rows,null,2));
 }catch(error){console.error(publicHostingError(error));process.exitCode=1;}
}
