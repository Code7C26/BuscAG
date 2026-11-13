import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SCENES,VIDEO,COLORS,NARRATION} from '../src/timeline.mjs';
test('90 second 1080p30 timeline covers every frame exactly and respects all five narrative acts',()=>{
 assert.deepEqual(VIDEO,{width:1920,height:1080,fps:30,seconds:90,frames:2700});let end=0;
 for(const scene of SCENES){assert.equal(scene.from,end);assert.ok(scene.to>scene.from);end=scene.to;}
 assert.equal(end,90);assert.equal(SCENES[0].to,12);assert.equal(SCENES.find(s=>s.id==='search').from,28);assert.equal(SCENES.find(s=>s.id==='chat').from,55);assert.equal(SCENES.at(-1).from,77);
 for(const [from,to,text] of NARRATION){assert.ok(from>=0&&to<=90&&to>from);assert.ok(text.length>4);}
});
test('logo is byte-identical to BuscAG and all five authentic brand tokens are preserved',async()=>{
 const hash=b=>createHash('sha256').update(b).digest('hex');assert.equal(hash(await readFile('public/brand/icon.svg')),hash(await readFile('../src/code/public/icon.svg')));
 const css=await readFile('../src/code/src/index.css','utf8');for(const [key,color] of Object.entries(COLORS))assert.equal(css.match(new RegExp('--brand-'+key+':\\s*(#[0-9a-fA-F]{6})'))?.[1].toLowerCase(),color);
});
test('every demonstrated screen is a captured real component with synthetic backend and valid PNG dimensions',async()=>{
 const manifest=JSON.parse(await readFile('public/captures/manifest.json','utf8'));assert.equal(manifest.mode,'real_ui_synthetic_backend');assert.equal(manifest.real_credentials,false);assert.equal(manifest.simulated_recovery,'confirmed');assert.match(manifest.app_tree,/^[0-9a-f]{40}$/);
 for(const name of new Set(SCENES.map(s=>s.asset).filter(Boolean))){assert.ok(manifest.captures.includes(name));const image=await readFile(`public/captures/${name}.png`);assert.equal(image.subarray(1,4).toString(),'PNG');assert.ok(image.readUInt32BE(16)>250);assert.ok(image.readUInt32BE(20)>200);}
});
test('original soundtrack is stereo 48kHz PCM16, exactly 90 seconds, audible and not clipping',async()=>{
 const wav=await readFile('public/audio/score.wav');assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt16LE(22),2);assert.equal(wav.readUInt32LE(24),48000);assert.equal(wav.readUInt16LE(34),16);assert.equal((wav.length-44)/(48000*4),90);
 let peak=0,energy=0;for(let i=44;i<wav.length;i+=200){const value=wav.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(value));energy+=value*value;}
 assert.ok(peak>.3&&peak<.95);assert.ok(energy>1);
});
