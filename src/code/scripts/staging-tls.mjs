// Trust is supplied out-of-band by the operator, never learned from a failed peer.
import {readFile,stat} from 'node:fs/promises';
import {X509Certificate} from 'node:crypto';
const publicErrors=new WeakSet(),contexts=new WeakMap(),secondaryErrors=new WeakMap();
const stages={configuration:'configuración',tcp:'TCP',tls:'TLS',authentication:'autenticación',queries:'consultas',closing:'cierre'};
const sqlClasses=new Set('00 01 02 03 08 09 0A 0B 0F 0L 0P 0Z 20 21 22 23 24 25 26 27 28 2B 2D 2F 34 38 39 3B 3D 3F 40 42 44 53 54 55 57 58 72 F0 HV P0 XX'.split(' '));
export function publicError(code,message){const error=new Error(message);error.code=code;error.publicMessage=message;publicErrors.add(error);return error;}
export function stageFailure(error,context){
  if(contexts.has(error))return error;
  const wrapped=error&&typeof error==='object'?error:new Error('Staging operation failed',{cause:error});
  contexts.set(wrapped,{stage:stages[context.stage]?context.stage:'configuration',lastCompleted:stages[context.lastCompleted]?context.lastCompleted:null,
    queryNumber:Number.isSafeInteger(context.queryNumber)&&context.queryNumber>0?context.queryNumber:null});
  return wrapped;
}
export function addSecondaryFailure(primary,secondary){
  if(primary===secondary)return primary;
  const errors=secondaryErrors.get(primary)??[];if(errors.length<4)errors.push(secondary);secondaryErrors.set(primary,errors);return primary;
}
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
  const context=contexts.get(error);
  const seen=new Set(),queue=[error],candidates=[];
  while(queue.length&&candidates.length<64){
    const item=queue.shift();if(!item||typeof item!=='object'||seen.has(item))continue;
    seen.add(item);candidates.push(item);queue.push(item.cause);
    if(Array.isArray(item.errors))queue.push(...item.errors.slice(0,64));
  }
  const finish=(category,code,message,inferredStage)=>({category,code,message,
    stage:stages[context?.stage??inferredStage??'configuration'],
    last_completed:stages[context?.lastCompleted]??'ninguno',
    query_number:context?.queryNumber??null,
    secondary:(secondaryErrors.get(error)??[]).map(e=>{const d=stagingDiagnostic(e);return {stage:d.stage,category:d.category,code:d.code,message:d.message};})});
  const knownMessages=new Map([
    ['The server does not support SSL connections',['TLS','BUSCAG_PG_SSL_REFUSED','El endpoint rechazó PostgreSQL SSLRequest. Usa el pooler de sesión oficial en 5432; un puerto TCP abierto no demuestra soporte TLS. No desactives TLS.','tls']],
    ['There was an error establishing an SSL connection',['TLS','BUSCAG_PG_SSL_RESPONSE','El endpoint no devolvió una respuesta PostgreSQL SSL válida. Verifica host/puerto del pooler y posibles proxies de red.','tls']],
    ['SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match',['autenticación','BUSCAG_SCRAM_SIGNATURE','Falló la verificación de la firma SCRAM. Verifica usuario/ref y contraseña vigente del pooler; codifica la contraseña original una sola vez. No ignores la firma ni debilites TLS.','authentication']],
    ['SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string',['autenticación','BUSCAG_PASSWORD_TYPE','El driver no recibió una contraseña de tipo texto. Revisa la construcción local de la URI y reinstala las dependencias con npm ci.','authentication']],
    ['Password must be a string',['autenticación','BUSCAG_PASSWORD_TYPE','El driver no recibió una contraseña de tipo texto. Revisa la construcción local de la URI y reinstala las dependencias con npm ci.','authentication']],
    ['SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a non-empty string',['autenticación','BUSCAG_PASSWORD_EMPTY','El driver recibió una contraseña vacía. Configura localmente la URI privada con contraseña, sin compartirla.','authentication']],
    ['Query read timeout',['consultas','BUSCAG_QUERY_TIMEOUT','La consulta excedió el tiempo de espera del cliente. Revisa disponibilidad y bloqueos del proyecto; no repitas escrituras a ciegas.','queries']],
    ['Tenant or user not found',['autenticación','BUSCAG_POOLER_IDENTITY','El pooler no reconoce proyecto/usuario. Copia su URI de sesión del Dashboard de Prueba y verifica postgres.REF y región; no cambies permisos ni datos.','authentication']],
    ['Max client connections reached',['disponibilidad','BUSCAG_POOLER_LIMIT','El pooler alcanzó su límite de conexiones. Revisa las conexiones y el estado en Dashboard; no reconstruyas la contraseña ni cambies permisos.','authentication']],
    ['MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size',['disponibilidad','BUSCAG_POOLER_LIMIT','El pooler de sesión alcanzó su capacidad. Revisa conexiones/límites y reintenta el diagnóstico cuando haya capacidad; no cambies a transaction pooler para forzar el plan.','authentication']],
    ['Client network socket disconnected before secure TLS connection was established',['TLS','BUSCAG_TLS_INTERRUPTED','El socket se cerró antes de verificar TLS. Revisa red, VPN/proxy y estado del pooler; todavía no se confirmó autenticación. No desactives TLS.','tls']],
    ['Client has already been connected. You cannot reuse a client.',['cliente','BUSCAG_CLIENT_REUSED','Se intentó reutilizar un cliente pg. Ejecuta el comando en un proceso nuevo y actualiza la copia de Alexis.','configuration']],
  ]);
  const trust=new Set(['SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','UNABLE_TO_GET_ISSUER_CERT']);
  for(const item of candidates){
    const code=item?.code;
    if(knownMessages.has(item.message))return finish(...knownMessages.get(item.message));
    if(item instanceof URIError||item.message==='URI malformed')return finish('configuración','BUSCAG_URI_ENCODING','La URI contiene escapes % inválidos o bytes no UTF-8. Codifica la contraseña original una sola vez con encodeURIComponent; un % literal debe ser %25. No imprimas la URI.','configuration');
    if(typeof item.message==='string'&&item.message.startsWith('SASL:'))return finish('autenticación','BUSCAG_SCRAM_PROTOCOL','Falló el intercambio SCRAM. Verifica usuario/ref y codificación de la contraseña; usa Node compatible y npm ci. No omitas la validación de integridad.','authentication');
    if(['timeout expired','Connection terminated due to connection timeout'].includes(item.message))return finish('conexión','BUSCAG_CONNECT_TIMEOUT','La conexión no terminó dentro del plazo. Revisa la etapa indicada: TCP abierto no confirma TLS ni autenticación del pooler.','tcp');
    if(['Connection terminated','Connection terminated unexpectedly','Client has encountered a connection error and is not queryable','Client was closed and is not queryable'].includes(item.message))return finish('conexión','BUSCAG_CONNECTION_TERMINATED','La conexión se cerró antes de completar la etapa indicada. Revisa estado/límites del pooler y red; si ocurrió durante consultas, no asumas un fallo de contraseña.','tcp');
    if(trust.has(code))return finish('TLS',code,'No se pudo verificar la cadena de confianza. Descarga la CA desde Database Settings de Supabase y configura BUSCAG_STAGING_CA_FILE; no desactives TLS.','tls');
    if(code==='ERR_TLS_CERT_ALTNAME_INVALID')return finish('TLS',code,'El certificado no coincide con el nombre del servidor. Revisa el host oficial del pooler; no anules la validación de hostname.','tls');
    if(['CERT_HAS_EXPIRED','CERT_NOT_YET_VALID'].includes(code))return finish('TLS',code,'Certificado vencido o todavía no válido. Revisa el reloj y contacta al proveedor si persiste.','tls');
    if(typeof code==='string'&&/^(ERR_TLS_|ERR_SSL_|ERR_OSSL_|ERR_CRYPTO_)/.test(code))return finish('TLS','BUSCAG_TLS_NEGOTIATION','Falló TLS o su soporte criptográfico. Usa Node compatible, verifica CA/hostname y reinstala con npm ci; no desactives la validación.','tls');
    if(typeof code==='string'&&/^28[A-Z0-9]{3}$/.test(code))return finish('autenticación',code,'PostgreSQL rechazó la autenticación. Verifica usuario postgres.REF y contraseña vigente, codificada una sola vez; no compartas la URI.','authentication');
    if(['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENETUNREACH','EHOSTUNREACH','EACCES','EPERM','EPIPE'].includes(code)||typeof code==='string'&&/^08[A-Z0-9]{3}$/.test(code))return finish('conexión',code,'No se pudo establecer o mantener la conexión. Revisa DNS, puerto 5432, firewall/VPN y estado del proyecto; consulta el último paso confirmado.','tcp');
    if(['53300','53400','57P03','57P01'].includes(code))return finish('disponibilidad',code,'El servidor/pooler no está disponible o alcanzó su límite. Revisa el estado y conexiones en Dashboard; reintenta sólo el diagnóstico, sin cambiar datos.','authentication');
    if(code==='42501')return finish('permisos',code,'El operador PostgreSQL no tiene los permisos requeridos; revisar la conexión de staging.','queries');
    if(code==='57014'||code==='55P03')return finish('consultas',code,'La consulta fue cancelada o no obtuvo un bloqueo a tiempo. Revisa disponibilidad/bloqueos; no aumentes límites ni repitas escrituras sin revisar.','queries');
    if(typeof code==='string'&&/^[0-9A-Z]{5}$/.test(code)&&sqlClasses.has(code.slice(0,2)))return finish('estructura/SQL',code,'Falló una comprobación u operación SQL. Revisa el esquema de staging y el paso pendiente; no reejecutes bootstrap.','queries');
    if(code==='ERR_MODULE_NOT_FOUND'||code==='MODULE_NOT_FOUND')return finish('dependencias','BUSCAG_DEPENDENCY_MISSING','Falta una dependencia local. Ejecuta npm ci desde src/code con la versión Node compatible del proyecto.','configuration');
    if(code==='ENOENT'||code==='ENOSPC')return finish('archivo local','BUSCAG_LOCAL_FILE','No se pudo leer/escribir un archivo local del plan. Revisa la copia del repositorio, espacio y permisos locales; no es un diagnóstico de contraseña.','queries');
    if(publicErrors.has(item))return finish(code.includes('CA_')||code.includes('TLS_')?'configuración TLS':code.includes('CLOSE_')?'cierre':'preflight',code,item.publicMessage,code.includes('CLOSE_')?'closing':'configuration');
  }
  const phase=context?.stage??'configuration';
  const fallbacks={configuration:['BUSCAG_SETUP_FAILURE','Falló la preparación local sin un código reconocido. Actualiza Alexis, ejecuta npm ci y verifica la configuración privada.'],tcp:['BUSCAG_TCP_FAILURE','Falló la apertura TCP sin código reconocido. Revisa DNS, salida al pooler de sesión/5432 y estado del proyecto.'],tls:['BUSCAG_TLS_FAILURE','TCP abrió, pero TLS no quedó confirmado. Revisa CA, hostname y proxies; no desactives TLS.'],authentication:['BUSCAG_AUTH_FAILURE','TLS quedó confirmado, pero la sesión PostgreSQL no terminó de autenticarse. Revisa usuario/ref y contraseña codificada una sola vez.'],queries:['BUSCAG_QUERY_FAILURE','La sesión abrió, pero falló una consulta o planificación sin código reconocido. Usa el número de consulta y verifica dependencias/catálogo; no reejecutes migraciones.'],closing:['BUSCAG_CLOSE_FAILURE','Falló el cierre del cliente. Reintenta sólo el diagnóstico de lectura; no repitas operaciones de escritura a ciegas.']};
  const category={configuration:'preflight',tcp:'conexión',tls:'TLS',authentication:'autenticación',queries:'consultas',closing:'cierre'}[phase];
  return finish(category,...fallbacks[phase],phase);
}
export function formatStagingDiagnostic(error){
  const d=stagingDiagnostic(error);
  const query=d.query_number?`; consulta #${d.query_number}`:'';
  const lines=[`Preparación detenida [etapa: ${d.stage}; último paso confirmado: ${d.last_completed}${query}] [${d.category}] ${d.code}. ${d.message}`];
  for(const e of d.secondary)lines.push(`Error secundario [${e.stage}] ${e.code}. ${e.message}`);
  return lines.join('\n');
}
