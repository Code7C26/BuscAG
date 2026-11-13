import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {SHOTS,V2,CLIPS} from './timeline.mjs';
test('60s/1800 frame montage is contiguous, has 30 beat-aligned shots and matches requested acts',()=>{
 assert.equal(V2.frames,1800);assert.equal(V2.bpm,120);assert.equal(SHOTS.length,30);let end=0;
 for(const s of SHOTS){assert.equal(s.from,end);assert.equal(s.from*30%15,0);assert.equal(s.to*30%15,0);assert.ok(s.to-s.from<=4.5);end=s.to;}
 assert.equal(end,60);assert.equal(SHOTS.find(s=>s.id==='brand').from,5);assert.equal(SHOTS.find(s=>s.id==='publish-title').from,12);assert.equal(SHOTS.find(s=>s.id==='drop').from,32);assert.equal(SHOTS.find(s=>s.id==='chat-title').from,40);assert.equal(SHOTS.find(s=>s.id==='final-reveal').from,53);
 assert.ok(new Set(SHOTS.map(s=>s.kind)).size>=17);
});
test('v1 film is preserved byte-for-byte',async()=>{
 const sha=createHash('sha256').update(await readFile('deliverables/BuscAG-trailer-draft.mp4')).digest('hex');
 assert.equal(sha,'bbcae3b755dc1d6e418a4de7be5c0936599cdf9d02ce40bb239ec120e9c9031f');
});
test('actual action clips are high-density 30 FPS H264, silent, and exactly match declared durations',async()=>{
 const m=JSON.parse(await readFile('public/v2/manifest.json','utf8'));assert.equal(m.synthetic_backend,true);assert.equal(m.real_credentials,false);assert.match(m.source_app_tree,/^[a-f0-9]{40}$/);
 for(const [name,duration] of Object.entries(CLIPS)){
  const p=spawnSync(process.env.FFPROBE_PATH||'ffprobe',['-v','error','-show_streams','-of','json',`public/v2/clips/${name}.mp4`],{encoding:'utf8'});assert.equal(p.status,0,'ffprobe required');
  const data=JSON.parse(p.stdout);assert.equal(data.streams.length,1);const v=data.streams[0];assert.equal(v.codec_type,'video');assert.equal(v.codec_name,'h264');assert.equal(v.width,3200);assert.equal(v.height,1800);assert.equal(v.avg_frame_rate,'30/1');assert.equal(Number(v.nb_frames),duration*30);assert.ok(Math.abs(Number(v.duration)-duration)<.05);
  assert.ok(m.clips.some(c=>c.name===name&&c.frames===duration*30));
 }
});
test('new original stereo score is 60s, has silence before the drop and stronger post-drop energy than intro',async()=>{
 const b=await readFile('public/audio/score-v2.wav');assert.equal((b.length-44)/(48000*4),60);assert.equal(b.readUInt16LE(22),2);assert.equal(b.readUInt32LE(24),48000);
 const rms=(from,to)=>{let energy=0,n=0;for(let i=Math.floor(from*48000);i<to*48000;i+=30){const v=b.readInt16LE(44+i*4)/32768;energy+=v*v;n++;}return Math.sqrt(energy/n);};
 assert.equal(rms(31.55,31.95),0);assert.ok(rms(32.05,33.5)>rms(.5,1.5)*1.5);assert.ok(rms(12,20)>.05);
 let peak=0;for(let i=44;i<b.length;i+=80)peak=Math.max(peak,Math.abs(b.readInt16LE(i))/32768);assert.ok(peak>.6&&peak<.95);
});

test('demo realtime acknowledges Phoenix v1/v2 filters locally without false connection errors',async()=>{
 const {demoSocketReply}=await import('./realtime.mjs');
 const payload={config:{postgres_changes:[{event:'*',schema:'public',table:'items'},{event:'INSERT',schema:'public',table:'messages',filter:'recipient_id=eq.demo'}]}};
 const reply=JSON.parse(demoSocketReply(JSON.stringify(['join','ref','realtime:demo','phx_join',payload])));
 assert.equal(reply[3],'phx_reply');assert.equal(reply[4].status,'ok');assert.deepEqual(reply[4].response.postgres_changes,payload.config.postgres_changes.map((b,i)=>({...b,id:i+1})));
 const old=JSON.parse(demoSocketReply(JSON.stringify({ref:'1',topic:'phoenix',event:'heartbeat',payload:{}})));assert.equal(old.event,'phx_reply');assert.equal(old.payload.status,'ok');
 assert.equal(demoSocketReply(JSON.stringify({event:'access_token'})),null);
});
