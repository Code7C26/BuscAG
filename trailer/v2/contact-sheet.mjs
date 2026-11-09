import {spawnSync} from 'node:child_process';
const input='deliverables/BuscAG-trailer-v2.mp4',ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
const frames=[30,120,180,440,600,755,922,1005,1100,1290,1450,1730];
const run=args=>{const p=spawnSync(ffmpeg,['-hide_banner','-loglevel','error',...args],{stdio:'inherit'});if(p.error||p.status!==0)throw Error('FFmpeg and complete V2 MP4 required');};
run(['-i',input,'-vf',`select=${frames.map(n=>`eq(n\\,${n})`).join('+')},scale=480:270,tile=4x3`,'-frames:v','1','-y','deliverables/storyboard-v2.jpg']);
run(['-ss','57.5','-i',input,'-frames:v','1','-y','deliverables/poster-v2.png']);
console.log('V2 sheet and poster extracted from the final MP4.');
