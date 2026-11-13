import {chromium} from '@playwright/test';
import {bundle} from '@remotion/bundler';
import {renderMedia,renderStill,selectComposition} from '@remotion/renderer';
import {SCENES} from '../src/timeline.mjs';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const concurrency=Number(process.env.BUSCAG_TRAILER_CONCURRENCY??(process.platform==='win32'?1:2));if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw Error('Concurrency must be between 1 and 4.');
const args=process.argv.slice(2);const sceneArg=args.find(a=>a.startsWith('--scene='));const scene=sceneArg?SCENES.find(s=>s.id===sceneArg.slice(8)):null;if(sceneArg&&!scene)throw Error('Unknown scene');if(args.some(a=>!['--draft','--smoke','--stills'].includes(a)&&a!==sceneArg))throw Error('Unknown render option');
const serveUrl=await bundle({entryPoint:resolve('src/index.ts'),publicDir:resolve('public')});
const browserExecutable=process.env.BUSCAG_TRAILER_BROWSER||['/usr/bin/chromium',chromium.executablePath()].find(path=>existsSync(path));
const inputProps={voiceover:existsSync('public/audio/voiceover.wav')};
const composition=await selectComposition({serveUrl,id:'BuscAG',browserExecutable,inputProps});
await mkdir('out',{recursive:true});
if(args.includes('--stills')){
 await mkdir('out/stills',{recursive:true});
 for(const frame of [200,420,570,740,940,1150,1340,1540,1750,1960,2180,2500])await renderStill({serveUrl,composition,frame,inputProps,browserExecutable,output:resolve(`out/stills/${frame}.png`)});
 console.log('12 representative frames rendered.');
}else{
 const smoke=args.includes('--smoke'),outputLocation=resolve(smoke?'out/render-smoke.mp4':scene?`out/scene-${scene.id}.mp4`:'deliverables/BuscAG-trailer-draft.mp4');await mkdir('deliverables',{recursive:true});let last=-1;
 await renderMedia({serveUrl,composition,inputProps,browserExecutable,outputLocation,codec:'h264',colorSpace:'bt709',pixelFormat:'yuv420p',crf:args.includes('--draft')?23:18,concurrency,imageFormat:'jpeg',jpegQuality:args.includes('--draft')?85:95,audioCodec:'aac',audioBitrate:'192k',...(smoke?{frameRange:[360,389]}:scene?{frameRange:[scene.from*30,scene.to*30-1]}:{}),onProgress:({progress})=>{const percent=Math.floor(progress*10)*10;if(percent!==last){console.log(`Render ${percent}%`);last=percent;}}});console.log(outputLocation);
}
