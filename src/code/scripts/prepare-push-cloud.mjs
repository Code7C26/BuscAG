// LOCAL PREPARATION ONLY. Does not import credentials, call Google/Supabase or execute CLI commands.
import {createHash} from 'node:crypto';
import {mkdir,readFile,realpath,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,relative,resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {STAGING_REF,STAGING_URL} from '../lib/stagingEnvironment.mjs';
const root=fileURLToPath(new URL('../../..',import.meta.url));
const app=fileURLToPath(new URL('..',import.meta.url));
const copies=[
 ['scripts/staging-push-worker.mjs','scripts/staging-push-worker.mjs'],
 ['scripts/push-cloud-service.mjs','scripts/push-cloud-service.mjs'],
 ['lib/stagingEnvironment.mjs','lib/stagingEnvironment.mjs'],
 ['lib/vapid.mjs','lib/vapid.mjs'],
 ['deployment/push-cloud/Dockerfile','Dockerfile']
];
const ignore='**\n!Dockerfile\n!.dockerignore\n!.gcloudignore\n!scripts/\n!scripts/staging-push-worker.mjs\n!scripts/push-cloud-service.mjs\n!lib/\n!lib/stagingEnvironment.mjs\n!lib/vapid.mjs\n';
const inside=(base,target)=>{const rel=relative(base,target);return !rel||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep));};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function cloudConfiguration(args){
 const options={};
 for(let i=0;i<args.length;i+=2){
  const name=args[i];if(!['--project-ref','--cloud-project','--output','--secret-version'].includes(name)||!args[i+1]||name in options)throw Error('Argumentos no admitidos o duplicados.');
  options[name]=args[i+1];
 }
 const project=options['--cloud-project'],output=options['--output'],version=options['--secret-version']??'1';
 if(options['--project-ref']!==STAGING_REF)throw Error('Sólo Supabase Prueba.');
 // A separate dedicated project: never the shared Firebase project containing production.
 if(typeof project!=='string'||project.length>30||!/^buscag-push-staging-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(project))throw Error('Usar un proyecto dedicado: buscag-push-staging-SUFIJO (máximo 30 caracteres).');
 if(!output||!isAbsolute(output)||!/^\d{1,9}$/.test(version)||Number(version)<1)throw Error('Indicar directorio absoluto NUEVO y versión numérica del secreto.');
 return {project,output,version,region:'us-east1'};
}
export async function preparePushCloud(config){
 // Refuse overwriting a previous context and refuse copying a context into this repository.
 config=cloudConfiguration(['--project-ref',STAGING_REF,'--cloud-project',config.project,'--output',config.output,'--secret-version',config.version??'1']);
 const repo=await realpath(root),parent=await realpath(dirname(config.output));
 if(inside(repo,parent))throw Error('El contexto debe quedar fuera del repositorio.');
 const inputs=[];
 for(const [source,destination] of copies){
  const sourcePath=await realpath(resolve(app,source));
  if(!inside(repo,sourcePath))throw Error('Fuente fuera del repositorio.');
  const bytes=await readFile(sourcePath);inputs.push({destination,bytes,sha256:hash(bytes)});
 }
 await mkdir(config.output,{mode:0o700});
 const context=resolve(config.output,'context');await mkdir(context,{mode:0o700});
 for(const input of inputs){const target=resolve(context,input.destination);await mkdir(dirname(target),{recursive:true});await writeFile(target,input.bytes,{flag:'wx',mode:0o600});}
 for(const name of ['.dockerignore','.gcloudignore'])await writeFile(resolve(context,name),ignore,{flag:'wx',mode:0o600});
 const digest=hash(inputs.map(x=>x.destination+':'+x.sha256).join('\n'));
 const {project,region,version}=config;
 const repository=`${region}-docker.pkg.dev/${project}/buscag-push`;
 const image=`${repository}/worker:src-${digest.slice(0,16)}`;
 const accounts=Object.fromEntries(['worker','scheduler','build'].map(role=>[role,`push-${role}@${project}.iam.gserviceaccount.com`]));
 const plan={
  version:1,mode:'local_review_only',authorization_to_deploy:false,project_ref:STAGING_REF,
  cloud_project:project,region,context,image,source_sha256:digest,secret_name:'buscag-staging-push-webhook',secret_version:version,
  accounts,service:'buscag-staging-push',scheduler:'buscag-staging-push-minute',schedule:'* * * * *',time_zone:'Etc/UTC',
  scheduler_target:'PRIVATE_CLOUD_RUN_SERVICE_URL/drain (resolved only after authorized deployment)',
  scheduler_auth:'OIDC via dedicated scheduler SA; run.invoker only on the service; audience = service URL',
  runtime_target:STAGING_URL+'/functions/v1/send-push',
  service_settings:{allow_unauthenticated:false,invoker_iam_check:true,concurrency:1,max_instances:1,min_instances:0,timeout_seconds:75,memory:'256Mi',cpu:1},
  files:inputs.map(({destination,sha256})=>({path:destination,sha256})),
  untouched:['Supabase/Firebase production','pg_net ACLs','Vault ACLs','buscag-staging-match-worker']
 };
 const build={
  steps:[{name:'gcr.io/cloud-builders/docker',args:['build','--platform=linux/amd64','-t',image,'.']}],
  images:[image],timeout:'600s',serviceAccount:`projects/${project}/serviceAccounts/${accounts.build}`,
  options:{logging:'CLOUD_LOGGING_ONLY'}
 };
 await writeFile(resolve(config.output,'deployment-plan.json'),JSON.stringify(plan,null,2)+'\n',{flag:'wx',mode:0o600});
 await writeFile(resolve(config.output,'cloudbuild.review.json'),JSON.stringify(build,null,2)+'\n',{flag:'wx',mode:0o600});
 return plan;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const plan=await preparePushCloud(cloudConfiguration(process.argv.slice(2)));console.log(JSON.stringify({mode:plan.mode,cloud_project:plan.cloud_project,project_ref:plan.project_ref,files:plan.files.length,authorization_to_deploy:false}));}
 catch{console.error('Preparación detenida. Revisar argumentos, fuentes y directorio absoluto nuevo fuera del repositorio. No se ejecutó ningún despliegue.');process.exitCode=1;}
}
