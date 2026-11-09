import {chromium} from '@playwright/test';
import {bundle} from '@remotion/bundler';
import {renderMedia,renderStill,selectComposition} from '@remotion/renderer';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {SHOTS} from './timeline.mjs';
const args=process.argv.slice(2),shotArg=args.find(a=>a.startsWith('--shot=')),shot=shotArg?SHOTS.find(s=>s.id===shotArg.slice(7)):null;
if(args.some(a=>!['--stills','--smoke'].includes(a)&&a!==shotArg)||shotArg&&!shot)throw Error('Invalid V2 render options');
const serveUrl=await bundle({entryPoint:resolve('v2/index.ts'),publicDir:resolve('public')});
const browserExecutable=process.env.BUSCAG_TRAILER_BROWSER||['/usr/bin/chromium',chromium.executablePath()].find(existsSync);
const composition=await selectComposition({serveUrl,id:'BuscAG-V2',browserExecutable});
await mkdir('out/v2',{recursive:true});
if(args.includes('--stills')){
 for(const frame of [45,80,180,245,440,570,670,755,900,985,1100,1290,1365,1420,1510,1630,1740])await renderStill({serveUrl,composition,browserExecutable,frame,output:resolve(`out/v2/${frame}.png`)});
 console.log('V2 representative frames rendered.');
}else{
 const concurrency=Number(process.env.BUSCAG_TRAILER_CONCURRENCY??(process.platform==='win32'?1:2));if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw Error('Invalid concurrency');
 const smoke=args.includes('--smoke'),outputLocation=resolve(smoke?'out/v2/smoke.mp4':shot?`out/v2/shot-${shot.id}.mp4`:'deliverables/BuscAG-trailer-v2.mp4');let progress=-1;
 await renderMedia({serveUrl,composition,browserExecutable,outputLocation,codec:'h264',colorSpace:'bt709',pixelFormat:'yuv420p',crf:19,concurrency,imageFormat:'jpeg',jpegQuality:94,audioCodec:'aac',audioBitrate:'256k',...(smoke?{frameRange:[960,989]}:shot?{frameRange:[shot.from*30,shot.to*30-1]}:{}),onProgress:({progress:p})=>{const next=Math.floor(p*10)*10;if(next!==progress){console.log(`V2 render ${next}%`);progress=next;}}});console.log(outputLocation);
}
