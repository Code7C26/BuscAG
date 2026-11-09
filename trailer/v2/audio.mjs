// Original 120 BPM electronic score: no samples, voices, network or licensed song.
import {mkdir,writeFile} from 'node:fs/promises';
import {SHOTS,V2} from './timeline.mjs';
const rate=48000,N=rate*V2.seconds,L=new Float32Array(N),R=new Float32Array(N),T=2*Math.PI;
let seed=90291;const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
const hz=m=>440*2**((m-69)/12),add=(at,d,fn,pan=0)=>{const start=Math.round(at*rate),end=Math.min(N,start+Math.round(d*rate));for(let i=Math.max(0,start);i<end;i++){const t=(i-start)/rate,v=fn(t);L[i]+=v*(.8-pan*.2);R[i]+=v*(.8+pan*.2);}};
const chords=[[50,57,60,65],[46,53,58,62],[53,60,65,69],[48,55,60,64]];
const saw=(f,t)=>Math.sin(T*f*t)+.35*Math.sin(T*f*2*t)+.17*Math.sin(T*f*3*t)+.1*Math.sin(T*f*4*t);
for(let bar=0;bar<30;bar++){
 const at=bar*2,c=chords[Math.floor(bar/2)%4],energy=at>=32&&at<53?1:at>=12?.62:.27;
 for(let n=1;n<4;n++){const f=hz(c[n]);add(at,2.5,t=>.027*energy*Math.min(1,t/.08)*Math.max(0,1-t/2.5)*(saw(f,t)+.3*saw(f*1.005,t)),n%2?-.65:.65);}
}
for(let beat=0;beat<120;beat++){
 const at=beat*.5,c=chords[Math.floor(at/4)%4];if(at<5||at>=56)continue;
 const power=at>=32&&at<53?1:at>=12?.8:.65;
 add(at,.36,t=>power*.27*Math.sin(T*(43*t+3.8*(1-Math.exp(-32*t))))*Math.exp(-13*t));
 add(at,.12,t=>power*.035*noise()*Math.exp(-65*t));
 if(beat%2){let filtered=0;add(at,.19,t=>{filtered=.35*filtered+.65*noise();return power*.115*filtered*Math.exp(-28*t);},.12);}
 for(let sub=0;sub<4;sub++)add(at+sub*.125,.075,t=>power*(sub%2?.028:.016)*noise()*Math.exp(-70*t),sub%2?-.5:.5);
 for(let off=0;off<2;off++){
  const f=hz(c[0]-12+(beat%8===7&&off===1?12:0));
  add(at+off*.25,.23,t=>power*.145*(Math.sin(T*f*t)+.23*Math.sin(T*f*2*t))*Math.min(1,t/.012)*Math.exp(-7*t));
 }
 if(at>=12){const melody=[0,2,1,3,2,1,3,2],note=c[melody[beat%8]]+12,f=hz(note);
  add(at+.25,.38,t=>power*.05*saw(f,t)*Math.min(1,t/.006)*Math.exp(-12*t),beat%2?-.4:.4);
 }
}
// Drop-only lead and syncopated chords introduce a new layer at 32s.
const hook=[0,2,3,2,1,2,0,1];
for(let at=32;at<53;at+=.25){
 const chord=chords[Math.floor(at/4)%4],step=Math.round((at-32)*4),f=hz(chord[hook[step%8]]+12);
 add(at,.28,t=>.044*(saw(f,t)+.32*saw(f*1.007,t)+.32*saw(f*.993,t))*Math.min(1,t/.008)*Math.exp(-9*t),step%2?-.55:.55);
 if(step%8===0||step%8===3||step%8===6)for(const note of chord.slice(1))add(at,.22,t=>.023*saw(hz(note),t)*Math.min(1,t/.008)*Math.exp(-12*t),step%2?.4:-.4);
}
add(28,3.5,t=>.045*Math.sin(T*(180*t+85*t*t))*Math.min(1,t/3.5),.3);
for(let at=28;at<31.5;at+=at<30?.25:.125)add(at,.13,t=>.09*noise()*Math.exp(-42*t));
// Riser and sub drop, synchronized to picture. Avoid repeated bright flashes in video.
for(const at of [5,12,17,24,28.5,32,40,46.5,49,53]){
 let low=0;add(Math.max(0,at-.6),.75,t=>{low=.85*low+.15*noise();return .11*low*Math.min(1,t/.55)*Math.exp(-Math.max(0,t-.6)*25);},-.2);
 add(at,1.05,t=>.19*Math.sin(T*36*t)*Math.exp(-7*t));
}
for(const s of SHOTS.filter(s=>s.from>=12&&s.from<53))add(s.from,.04,t=>.018*noise()*Math.exp(-100*t),.3);
for(const at of [0,1.5,3.5])add(at,1.3,t=>.11*Math.sin(T*38*t)*Math.exp(-4*t));
for(let i=0;i<5;i++)add(53+i*.15,3,t=>.045*saw(hz([62,65,69,74,77][i]),t)*Math.min(1,t/.01)*Math.exp(-2.7*t),i/3-.6);
let peak=0;for(let i=0;i<N;i++){const t=i/rate;if(t>=31.5&&t<32){L[i]=0;R[i]=0;}const fade=Math.min(1,t/.2)*Math.min(1,(60-t)/.9);L[i]=Math.tanh(L[i]*2.8)*fade;R[i]=Math.tanh(R[i]*2.8)*fade;peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));}
const b=Buffer.alloc(44+N*4);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(N*4,40);
for(let i=0;i<N;i++){b.writeInt16LE(Math.round(L[i]/peak*.84*32767),44+i*4);b.writeInt16LE(Math.round(R[i]/peak*.84*32767),46+i*4);}
await mkdir('public/audio',{recursive:true});await writeFile('public/audio/score-v2.wav',b);
console.log('V2 original score: 60s, 120 BPM, beat at 5s, build 28s, silent beat 31.5s, drop 32s. No voice.');
