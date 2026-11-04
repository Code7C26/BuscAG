// Trust is supplied out-of-band by the operator, never learned from a failed peer.
import {readFile,stat} from 'node:fs/promises';
import {X509Certificate} from 'node:crypto';
export function publicError(code,message){const error=new Error(message);error.code=code;error.publicMessage=message;return error;}
export function validateRootCa(bytes,expectedFingerprint,now=Date.now()){
  const text=bytes.toString('utf8').trim();
  if(bytes.length>65536||!/^-----BEGIN CERTIFICATE-----\s+[A-Za-z0-9+/=\s]+-----END CERTIFICATE-----$/.test(text))throw publicError('BUSCAG_CA_INVALID','La CA debe ser un único certificado raíz PEM, sin claves privadas ni contenido adicional.');
  let cert;try{cert=new X509Certificate(text);}catch{throw publicError('BUSCAG_CA_INVALID','No se pudo interpretar el certificado raíz PEM.');}
  if(!cert.ca||!cert.checkIssued(cert)||!cert.verify(cert.publicKey))throw publicError('BUSCAG_CA_INVALID','El archivo no contiene una CA raíz autofirmada válida.');
  if(now<Date.parse(cert.validFrom)||now>Date.parse(cert.validTo))throw publicError('BUSCAG_CA_INVALID','La CA está vencida o todavía no es válida; verifica también el reloj.');
  if(expectedFingerprint){
    const normalized=expectedFingerprint.replaceAll(':','').toUpperCase();
    if(!/^[A-F0-9]{64}$/.test(normalized)||cert.fingerprint256.replaceAll(':','')!==normalized)throw publicError('BUSCAG_CA_INVALID','La huella SHA-256 de la CA no coincide con la referencia configurada. No confiar en el certificado recibido del servidor.');
  }
  return {ca:cert.toString(),fingerprint256:cert.fingerprint256};
}
export async function loadStagingCa(env=process.env){
  if(env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw publicError('BUSCAG_TLS_UNSAFE','Elimina NODE_TLS_REJECT_UNAUTHORIZED=0; la validación TLS debe permanecer activa.');
  const file=env.BUSCAG_STAGING_CA_FILE;
  if(!file){
    if(env.BUSCAG_STAGING_CA_SHA256)throw publicError('BUSCAG_CA_INVALID','BUSCAG_STAGING_CA_SHA256 requiere BUSCAG_STAGING_CA_FILE.');
    return {};
  }
  let bytes;try{
    const metadata=await stat(file);if(!metadata.isFile()||metadata.size>65536)throw Error();
    bytes=await readFile(file);
  }catch{throw publicError('BUSCAG_CA_INVALID','No se pudo leer BUSCAG_STAGING_CA_FILE como certificado regular de hasta 64 KiB.');}
  return validateRootCa(bytes,env.BUSCAG_STAGING_CA_SHA256);
}
export function stagingDiagnostic(error){
  const candidates=[error,error?.cause,...(Array.isArray(error?.errors)?error.errors:[])];
  const trust=new Set(['SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','UNABLE_TO_GET_ISSUER_CERT']);
  for(const item of candidates){
    const code=item?.code;
    if(trust.has(code))return {category:'TLS',code,message:'No se pudo verificar la cadena de confianza. Descarga la CA desde Database Settings de Supabase y configura BUSCAG_STAGING_CA_FILE; no desactives TLS.'};
    if(code==='ERR_TLS_CERT_ALTNAME_INVALID')return {category:'TLS',code,message:'El certificado no coincide con el nombre del servidor. Revisa el host oficial del pooler; no anules la validación de hostname.'};
    if(['CERT_HAS_EXPIRED','CERT_NOT_YET_VALID'].includes(code))return {category:'TLS',code,message:'Certificado vencido o todavía no válido. Revisa el reloj y contacta al proveedor si persiste.'};
    if(typeof code==='string'&&/^(ERR_TLS_|ERR_SSL_)/.test(code))return {category:'TLS',code:code.replace(/[^A-Z0-9_]/g,''),message:'Falló la negociación TLS; revisar certificados y versiones sin desactivar la validación.'};
    if(typeof code==='string'&&/^28[A-Z0-9]{3}$/.test(code))return {category:'autenticación',code,message:'PostgreSQL rechazó la autenticación. Verifica localmente usuario, contraseña y proyecto; no compartas la URI.'};
    if(['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENETUNREACH','EHOSTUNREACH'].includes(code)||typeof code==='string'&&/^08[A-Z0-9]{3}$/.test(code))return {category:'conexión',code,message:'No se pudo establecer o mantener la conexión. Revisa DNS, puerto 5432, red y estado del proyecto.'};
    if(code==='42501')return {category:'permisos',code,message:'El operador PostgreSQL no tiene los permisos requeridos; revisar la conexión de staging.'};
    if(typeof code==='string'&&/^[0-9A-Z]{5}$/.test(code))return {category:'estructura/SQL',code,message:'Falló una comprobación u operación SQL. Revisa el esquema de staging y el paso pendiente; no reejecutes bootstrap.'};
    if(typeof code==='string'&&code.startsWith('BUSCAG_')&&typeof item.publicMessage==='string')return {category:code.includes('CA_')||code.includes('TLS_')?'configuración TLS':'preflight',code,message:item.publicMessage};
  }
  // Do not print arbitrary error messages, stack traces, hostnames or connection strings.
  return {category:'conexión/ejecución',code:'UNKNOWN',message:'Operación detenida. No se muestran detalles privados; revisa configuración y conectividad local.'};
}
