import {spawnSync} from 'node:child_process';
import {assertDisposableCluster} from '../tests/backupRestoreDrill.mjs';
try {assertDisposableCluster();}
catch {console.error('Requires BUSCAG_TEST_CLUSTER=disposable, LOCAL_PG_SOCKET and a BUSCAG_TEST_CONTAINER labelled buscag.disposable=true, with no network and tmpfs data.');process.exit(1);}
const result=spawnSync(process.execPath,['tests/activation-order.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,TEST_BACKUP_RESTORE:'1'},stdio:'inherit'});
if(result.error||result.status!==0)process.exit(result.status||1);
