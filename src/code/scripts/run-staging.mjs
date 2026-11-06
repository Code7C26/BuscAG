// No .env files or production client settings are loaded by this launcher.
import {visitorSettingsError} from '../lib/visitorAuth.mjs';
import {spawn} from 'node:child_process';
import {checkStagingPublic} from './check-staging-public.mjs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {stagingEnvironment,STAGING_URL,STAGING_APP_URL} from '../lib/stagingEnvironment.mjs';
export function stagingProcessEnvironment(source){
  const selected=stagingEnvironment(source.BUSCAG_STAGING_PUBLISHABLE_KEY,source.BUSCAG_STAGING_VAPID_PUBLIC_KEY);
  const result=Object.fromEntries(Object.entries(source).filter(([name])=>!name.startsWith('VITE_')));
  delete result.BUSCAG_STAGING_DATABASE_URL;
  return {...result,...selected};
}
export function stagingArguments(args){
  if(args.some(x=>!['--build','--visitors'].includes(x))||new Set(args).size!==args.length)throw Error('Sólo se admite --build y --visitors opcionales.');
  return {build:args.includes('--build'),visitors:args.includes('--visitors')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const args=process.argv.slice(2);const options=stagingArguments(args);
    const env=stagingProcessEnvironment(process.env);
    if(!args.includes('--build')){
      const readiness=await checkStagingPublic(env.VITE_SUPABASE_PUBLISHABLE_KEY);
      if(options.visitors){const error=visitorSettingsError(readiness);if(error)throw Error(error);console.log('Registro de visitantes y confirmación obligatoria verificados en Auth. La entrega SMTP debe probarse en un buzón real.');}
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
