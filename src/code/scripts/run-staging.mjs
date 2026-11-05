// No .env files or production client settings are loaded by this launcher.
import {spawn} from 'node:child_process';
import {checkStagingPublic} from './check-staging-public.mjs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {stagingEnvironment,STAGING_URL,STAGING_APP_URL} from '../lib/stagingEnvironment.mjs';
export function stagingProcessEnvironment(source){
  const selected=stagingEnvironment(source.BUSCAG_STAGING_PUBLISHABLE_KEY);
  const result=Object.fromEntries(Object.entries(source).filter(([name])=>!name.startsWith('VITE_')));
  delete result.BUSCAG_STAGING_DATABASE_URL;
  return {...result,...selected};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const args=process.argv.slice(2);if(args.length>1||args.some(x=>x!=='--build'))throw Error('Sólo se admite --build opcional.');
    const env=stagingProcessEnvironment(process.env);
    if(!args.includes('--build')){
      const readiness=await checkStagingPublic(env.VITE_SUPABASE_PUBLISHABLE_KEY);
      console.log('Preflight público de staging correcto: Auth accesible y acceso anónimo bloqueado.');
      if(!readiness.email_enabled||readiness.signup_disabled)console.warn('Revisar Auth de staging: email deshabilitado o registro bloqueado.');
      if(readiness.email_autoconfirm)console.warn('Auth confirma emails automáticamente: la verificación por correo no podrá darse por probada.');
    }
    console.log(`BuscAG-Staging: ${STAGING_URL}; frontend ${STAGING_APP_URL}. Sin configuración de producción.`);
    const vite=new URL('../node_modules/vite/bin/vite.js',import.meta.url);
    const child=spawn(process.execPath,[fileURLToPath(vite),...(args.includes('--build')?['build']:[]),'--mode','staging'],{cwd:new URL('..',import.meta.url),env,stdio:'inherit',shell:false});
    child.on('error',()=>{console.error('No se pudo iniciar Vite; ejecutar npm ci.');process.exitCode=1;});
    child.on('exit',code=>{process.exitCode=code??1;});
  }catch(error){console.error(error.message);process.exitCode=1;}
}
