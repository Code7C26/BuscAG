// Runs only disposable, synthetic databases. No URLs, credentials or remote hosts.
import {spawnSync} from 'node:child_process';
const mode=process.argv[2]??'pglite';
if(!['pglite','postgres'].includes(mode))throw Error('Use pglite or postgres');
if(mode==='postgres'&&(!process.env.LOCAL_PG_SOCKET?.startsWith('/')||process.env.BUSCAG_TEST_CLUSTER!=='disposable')){
  console.error('PostgreSQL requires LOCAL_PG_SOCKET and BUSCAG_TEST_CLUSTER=disposable. Never point this at production.');process.exit(1);
}
for(const [type,shape] of [['date','repository'],['timestamptz','repository'],['date','observed']]){
  const env={...process.env,TEST_ITEM_DATE_TYPE:type,TEST_SCHEMA_SHAPE:shape};
  if(mode==='pglite'){delete env.LOCAL_PG_SOCKET;delete env.PG_TEST_MODULE;delete env.PGLITE_MODULE;}
  console.log(`Testing ${type} in ${mode} (structural ${shape} fixture; synthetic data and repository trigger stand-ins)`);
  const result=spawnSync(process.execPath,['tests/security.mjs'],{cwd:new URL('..',import.meta.url),env,stdio:'inherit'});
  if(result.error||result.status!==0){console.error('Backend matrix failed.');process.exit(result.status||1);}
}

const integrationEnv={...process.env};
if(mode==='pglite'){delete integrationEnv.LOCAL_PG_SOCKET;delete integrationEnv.PG_TEST_MODULE;}
const integration=spawnSync(process.execPath,['tests/activation-order.mjs'],{cwd:new URL('..',import.meta.url),env:integrationEnv,stdio:'inherit'});
if(integration.error||integration.status!==0)process.exit(integration.status||1);
const upgrade=spawnSync(process.execPath,['--test','tests/staging-upgrade.test.mjs'],{cwd:new URL('..',import.meta.url),env:integrationEnv,stdio:'inherit'});
if(upgrade.error||upgrade.status!==0)process.exit(upgrade.status||1);
