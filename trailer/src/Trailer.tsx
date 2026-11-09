import React,{useEffect,useState,type CSSProperties} from 'react';
import {AbsoluteFill,Audio,Img,Sequence,continueRender,delayRender,interpolate,spring,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {COLORS as C,SCENES,VIDEO} from './timeline.mjs';
const ease=(x:number)=>1-(1-Math.max(0,Math.min(1,x)))**3;
const txt=(value:string)=>value.split('\n').map((line,i)=><React.Fragment key={i}>{i>0&&<br/>}{line}</React.Fragment>);
function Backdrop(){const f=useCurrentFrame();return <AbsoluteFill style={{background:C.petroleum,overflow:'hidden'}}>
 <div style={{position:'absolute',inset:-150,background:`radial-gradient(ellipse at ${68+Math.sin(f/310)*13}% 45%,#24525b77,transparent 53%),radial-gradient(ellipse at 15% 95%,#77aca222,transparent 45%)`}}/>
 <div style={{position:'absolute',inset:0,opacity:.15,backgroundImage:'linear-gradient(#9dbebb22 1px,transparent 1px),linear-gradient(90deg,#9dbebb22 1px,transparent 1px)',backgroundSize:'92px 92px',transform:`perspective(900px) rotateX(60deg) translateY(${190+f%92}px) scale(1.6)`,transformOrigin:'center bottom'}}/>
 {[0,1,2].map(i=><div key={i} style={{position:'absolute',width:730+i*260,height:730+i*260,border:'1px solid #77aca212',borderRadius:'50%',left:870-i*130,top:170-i*130,transform:`rotate(${f/15}deg)`}}/>)}
 {Array.from({length:22},(_,i)=><div key={i} style={{position:'absolute',width:i%4===0?3:2,height:i%4===0?3:2,borderRadius:'50%',background:C.sage,opacity:.1+Math.sin(f/70+i)*.08,left:(i*193+73)%1920,top:((i*127+f*.07)%1080)}}/>)}
 <AbsoluteFill style={{boxShadow:'inset 0 0 230px 80px #010b12aa'}}/>
 </AbsoluteFill>}
function Brand({size=44}:{size?:number}){return <div style={{display:'flex',alignItems:'center',gap:size*.25}}><Img src={staticFile('brand/icon.svg')} style={{width:size*1.25,height:size*1.25}}/><span style={{fontSize:size,fontWeight:760,letterSpacing:-size*.05}}>Busc<span style={{color:C.sage}}>AG</span></span></div>}
function Screen({asset,phone=false,style={}}:{asset:string;phone?:boolean;style?:CSSProperties}){return <div style={{position:'absolute',borderRadius:phone?45:22,overflow:'hidden',border:phone?'10px solid #19313b':'1px solid #9dbebb66',background:'#0c202b',boxShadow:'0 42px 90px #0009, 0 0 50px #77aca21c',...style}}>
 {phone?<div style={{height:26,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:80,height:9,background:'#000',borderRadius:9}}/></div>:<div style={{height:32,display:'flex',gap:7,alignItems:'center',paddingLeft:16}}>{[C.sage,C.mist,C.teal].map(c=><div key={c} style={{width:7,height:7,borderRadius:8,background:c,opacity:.7}}/>)}<span style={{fontSize:10,marginLeft:12,color:C.mist,letterSpacing:2}}>BUSCAG / DEMOSTRACIÓN</span></div>}
 <Img src={staticFile(`captures/${asset}.png`)} style={{width:'100%',display:'block'}}/>
 </div>}
function Scene({scene}:{scene:typeof SCENES[number]}){
 const f=useCurrentFrame(),{fps}=useVideoConfig(),d=(scene.to-scene.from)*fps,p=f/d;
 const enter=spring({frame:f,fps,config:{damping:200,stiffness:80}});
 const opacity=interpolate(f,[0,13,d-13,d],[0,1,1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const camera=`perspective(1800px) rotateY(${-7+p*5}deg) rotateX(${3-p*2}deg) scale(${.97+p*.045})`;
 const isRecovery=scene.id==='handover'||scene.id==='recovered';
 if(scene.id==='problem')return <AbsoluteFill style={{opacity}}>
  <div style={{position:'absolute',left:970,top:115,width:690,height:800,transform:`perspective(1500px) rotateY(${-18+p*24}deg) rotateZ(${-7+p*8}deg) translateY(${Math.sin(f/38)*9}px)`,opacity:f>220?1-(f-220)/180:1}}><Img src={staticFile('demo/backpack.svg')} style={{width:700,borderRadius:100,boxShadow:'0 0 100px #77aca222'}}/></div>
  <div style={{position:'absolute',left:105,top:290,width:850,transform:`translateY(${(1-enter)*40}px)`}}><div className="eyebrow">LO QUE IMPORTA</div><h1 style={{fontSize:103,lineHeight:1.06,margin:'28px 0',fontWeight:650,letterSpacing:-5}}>{f<170?<>No es sólo<br/>un objeto.</>:<>Es lo que<br/><span style={{color:C.sage}}>llevás con vos.</span></>}</h1><div style={{width:82,height:3,background:C.sage,marginTop:43}}/><p style={{fontSize:25,color:C.mist,marginTop:28}}>Y cuando falta, se siente.</p></div>
 </AbsoluteFill>;
 if(scene.id==='reveal')return <AbsoluteFill style={{opacity,justifyContent:'center',alignItems:'center'}}><div style={{transform:`scale(${.83+.17*ease(f/45)}) translateY(${(1-enter)*30}px)`}}><Brand size={155}/></div><p style={{fontSize:29,color:C.mist,letterSpacing:1,marginTop:43}}>Objetos perdidos. Personas conectadas.</p><div style={{height:1,width:620,marginTop:32,background:'linear-gradient(90deg,transparent,#77aca2,transparent)'}}/></AbsoluteFill>;
 if(scene.id==='close')return <AbsoluteFill style={{opacity,alignItems:'center',justifyContent:'center',textAlign:'center'}}><div style={{transform:`translateY(${(1-enter)*28}px)`}}><div style={{display:'flex',justifyContent:'center',marginBottom:36}}><Brand size={93}/></div><h1 style={{fontSize:100,fontWeight:640,letterSpacing:-4,lineHeight:1.14,margin:0}}>{txt(scene.title)}</h1><p style={{fontSize:25,letterSpacing:3,color:C.sage,marginTop:46}}>PUBLICÁ. CONECTÁ. RECUPERÁ.</p><p style={{fontSize:18,color:C.mist,marginTop:35}}>Encontrarnos hace la diferencia.</p></div></AbsoluteFill>;
 return <AbsoluteFill style={{opacity}}>
  <div style={{position:'absolute',left:94,top:isRecovery?270:257,width:isRecovery?710:650,transform:`translateY(${(1-enter)*28}px)`}}>
   <div className="eyebrow">{scene.chapter}</div><h1 style={{fontSize:isRecovery?78:83,lineHeight:1.09,fontWeight:630,letterSpacing:-3.7,margin:'28px 0'}}>{txt(scene.title)}</h1><p style={{fontSize:26,lineHeight:1.55,color:C.mist,maxWidth:565}}>{scene.subtitle}</p>
   <div style={{marginTop:39,display:'flex',alignItems:'center',gap:15}}><span style={{width:36,height:2,background:C.sage}}/><span style={{fontSize:14,letterSpacing:3,color:C.sage}}>ENCONTRARNOS HACE LA DIFERENCIA</span></div>
  </div>
  {scene.id==='community'?<><Screen asset="home-desktop" style={{left:925,top:250,width:1030,transform:camera,opacity:.57}}/><Screen phone asset="home-phone" style={{left:1000,top:140,width:370,transform:`perspective(1800px) rotateY(${-8+p*8}deg) translateY(${(1-enter)*55}px)`}}/></>:
   scene.id==='publish'?<Screen asset="publish" style={{left:1070,top:110,width:480,transform:camera}}/>:
   scene.id==='chat'?<><Screen phone asset="home-phone" style={{left:1350,top:175,width:310,opacity:.38,transform:'rotate(6deg)'}}/><Screen asset="chat" style={{left:1010,top:110,width:525,transform:camera}}/></>:
   isRecovery?<div style={{position:'absolute',left:920,top:scene.id==='recovered'?280:200,width:770,transform:camera}}><div style={{fontSize:14,color:C.sage,letterSpacing:3,marginBottom:22}}>{scene.id==='recovered'?'CONFIRMACIÓN COMPLETADA':'CONFIRMACIÓN BILATERAL'}</div><div style={{borderRadius:20,overflow:'hidden',boxShadow:'0 30px 80px #0009',border:'1px solid #9dbebb55'}}><Img src={staticFile(`captures/${scene.asset}.png`)} style={{width:'100%',display:'block'}}/></div>{scene.id==='recovered'&&<div style={{fontSize:100,textAlign:'center',color:C.sage,marginTop:30,opacity:enter}}>✓</div>}</div>:
   <Screen asset={scene.asset!} style={{left:scene.id==='matches'?1030:790,top:scene.id==='matches'?96:220,width:scene.id==='matches'?690:1080,transform:camera}}/>}
  {scene.id==='map'&&<div style={{position:'absolute',right:74,bottom:117,fontSize:14,color:C.mist}}>Cartografía ilustrativa · controles reales</div>}
 </AbsoluteFill>;
}
export function Trailer({voiceover=false}:{voiceover?:boolean}){
 const [handle]=useState(()=>delayRender('Load bundled font'));useEffect(()=>{document.fonts.load('650 80px Manrope').then(()=>continueRender(handle));},[handle]);const f=useCurrentFrame();
 return <AbsoluteFill style={{fontFamily:'Manrope, sans-serif',color:C.cream}}>
 <style>{`@font-face{font-family:Manrope;src:url('${staticFile('brand/manrope.woff2')}') format('woff2');font-weight:200 800;font-display:block}*{box-sizing:border-box}.eyebrow{font-size:17px;letter-spacing:4px;color:${C.sage};font-weight:650}`}</style>
 <Backdrop/>
 {SCENES.map(scene=><Sequence key={scene.id} from={scene.from*VIDEO.fps} durationInFrames={(scene.to-scene.from)*VIDEO.fps}><Scene scene={scene}/></Sequence>)}
 <div style={{position:'absolute',top:53,left:91,opacity:f>360&&f<2310?.8:0}}><Brand size={28}/></div>
 <div style={{position:'absolute',left:94,right:94,bottom:48,display:'flex',justifyContent:'space-between',fontSize:12,letterSpacing:2,color:C.mist,opacity:.7}}><span>INTERFAZ REAL · DATOS DE DEMOSTRACIÓN</span><span>BUSCAG / OBJETOS PERDIDOS. PERSONAS CONECTADAS.</span></div>
 <div style={{position:'absolute',bottom:29,left:94,right:94,height:1,background:'#9dbebb22'}}><div style={{height:1,width:`${f/(VIDEO.frames-1)*100}%`,background:C.sage}}/></div>
 <Audio src={staticFile('audio/score.wav')} volume={voiceover?.45:.9}/>{voiceover&&<Audio src={staticFile('audio/voiceover.wav')} volume={1}/>}
 </AbsoluteFill>;
}
