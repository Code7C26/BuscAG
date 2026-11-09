// Original procedural score and sound design. No recordings, samples or network.
import {mkdir,writeFile} from 'node:fs/promises';
const rate=48000,duration=90,N=rate*duration,L=new Float32Array(N),R=new Float32Array(N);
const TAU=Math.PI*2,frequency=midi=>440*2**((midi-69)/12);
let seed=73423;const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
const add=(at,seconds,fn,pan=0)=>{const start=Math.round(at*rate),end=Math.min(N,start+Math.round(seconds*rate));for(let n=Math.max(0,start);n<end;n++){const v=fn((n-start)/rate,n);L[n]+=v*(.8-pan*.2);R[n]+=v*(.8+pan*.2);}};
const chords=[[45,52,57,60,64],[41,48,53,57,60],[48,55,60,64,67],[43,50,55,59,62]];
for(let bar=0;bar<23;bar++){
 const at=bar*4,chord=chords[bar%4];
 for(let j=1;j<5;j++){const hz=frequency(chord[j]);add(at,5.3,t=>{const env=Math.min(t/1.3,1)*Math.max(0,1-t/5.3);return .033*env*(Math.sin(TAU*hz*t)+.3*Math.sin(TAU*hz*1.003*t));},(j%2?-.7:.7));}
 add(at,4,t=>.1*Math.sin(TAU*frequency(chord[0]-12)*t)*Math.min(t/.1,1)*Math.max(0,1-t/4));
}
for(let beat=0;beat<150;beat++){
 const at=beat*.6;
 if(at>=12&&at<77){
  add(at,.22,t=>.17*Math.sin(TAU*(42*t+4*(1-Math.exp(-25*t))))*Math.exp(-22*t));
  if(beat%2)add(at,.14,t=>.045*noise()*Math.exp(-35*t),.2);
  if(at>=28){const chord=chords[Math.floor(at/4)%4],note=chord[(beat%4)+1]+12,hz=frequency(note);add(at,.75,t=>.045*Math.sin(TAU*hz*t)*Math.exp(-8*t)*Math.min(t/.012,1),beat%2?-.55:.55);add(at+.3,.45,t=>.018*Math.sin(TAU*hz*t)*Math.exp(-10*t),beat%2?.6:-.6);}
 }
}
for(const at of [2,7,12,16,22,28,35,42,48,55,62,69,77,83]){
 let filtered=0;add(Math.max(0,at-.7),1.15,t=>{filtered=.93*filtered+.07*noise();return .19*filtered*Math.sin(Math.PI*Math.min(t/1.15,1))*(t<.7?t/.7:Math.exp(-(t-.7)*8));},-.2);
 add(at,1.5,t=>.15*Math.sin(TAU*49*t)*Math.exp(-5*t));
}
for(const at of [69.5,70.1,77])for(const [k,m] of [69,72,76].entries())add(at+k*.08,2,t=>.07*Math.sin(TAU*frequency(m)*t)*Math.exp(-3*t),k/2-.5);
let peak=0;for(let i=0;i<N;i++){const t=i/rate,fade=Math.min(1,t/1.5)*Math.min(1,(duration-t)/2.6);L[i]*=fade;R[i]*=fade;peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));}
const out=Buffer.alloc(44+N*4);out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(2,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*4,28);out.writeUInt16LE(4,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(N*4,40);
for(let i=0;i<N;i++){out.writeInt16LE(Math.round(L[i]/peak*.82*32767),44+i*4);out.writeInt16LE(Math.round(R[i]/peak*.82*32767),46+i*4);}
await mkdir('public/audio',{recursive:true});await writeFile('public/audio/score.wav',out);console.log('Original stereo score + SFX: 90 seconds, 48kHz, PCM16, peak below -1dBFS.');
