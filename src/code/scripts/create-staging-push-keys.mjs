// Local key generation only. Output must be outside the repository; never stdout.
import {createECDH,randomBytes} from 'node:crypto';
import {writeFileSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
export function createKeys(subject){
 if(typeof subject!=='string'||!/^mailto:[^\s@]+@[^\s@]+$/.test(subject)||/[\r\n]/.test(subject))throw Error('Usar mailto: con el contacto real del responsable.');
 const ecdh=createECDH('prime256v1');ecdh.generateKeys();
 return {PUSH_VAPID_PUBLIC_KEY:ecdh.getPublicKey().toString('base64url'),PUSH_VAPID_PRIVATE_KEY:ecdh.getPrivateKey().toString('base64url'),PUSH_VAPID_SUBJECT:subject,PUSH_WEBHOOK_SECRET:randomBytes(32).toString('hex')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [file,subject,...extra]=process.argv.slice(2);if(!file||extra.length)throw Error();
  const root=realpathSync(fileURLToPath(new URL('../../..',import.meta.url)));
  const target=resolve(file),parent=realpathSync(resolve(target,'..'));
  const rel=relative(root,parent);if(!rel||(!rel.startsWith('..')&&!isAbsolute(rel)))throw Error();
  const keys=createKeys(subject);writeFileSync(target,Object.entries(keys).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{flag:'wx',mode:0o600});
  console.log('Archivo privado creado fuera del repositorio. No se configuró ningún servidor. No publicar ni pegar su contenido.');
 }catch{console.error('No se crearon claves. Indicar archivo NUEVO fuera del repositorio y mailto: del responsable. No sobrescribir claves existentes.');process.exitCode=1;}
}
