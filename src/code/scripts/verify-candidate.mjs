import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {verifyCandidate} from '../lib/candidateArtifact.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
try{
 if(process.argv.length!==2)throw Error();
 const git=args=>spawnSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']});
 const sha=git(['rev-parse','HEAD']),status=git(['status','--porcelain']),branch=git(['branch','--show-current']);
 if(sha.status!==0||status.status!==0||status.stdout.trim()||branch.stdout.trim()!=='Alexis')throw Error();
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 console.log(JSON.stringify(await verifyCandidate(fileURLToPath(new URL('../dist-presentation/',import.meta.url)),{commit:sha.stdout.trim(),version:pkg.version}),null,2));
 console.log('Integridad local verificada. No autoriza ni ejecuta publicación; falta la aceptación de los flujos reales.');
}catch{
 console.error('No se pudo verificar la candidata. Usá Alexis limpio, compilá con npm run build:rc y conservá el artefacto completo.');process.exitCode=1;
}
