import React, {useEffect,useRef,useState} from 'react';
import {communityCall,ServiceUnavailableError} from '../../lib/community';
/** Separate availability keeps the installed community features usable before push SQL activation. */
export function UserFollowButton({targetId,userId,blocked}:{targetId:string;userId:string;blocked:boolean}){
 const [following,setFollowing]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
 const pending=useRef(false),epoch=useRef(0);
 useEffect(()=>{const version=++epoch.current;setFollowing(null);setNotice('');
  void communityCall('my_user_follow',{p_target:targetId}).then(value=>{if(epoch.current===version)setFollowing(value);}).catch(error=>{
   if(epoch.current===version)setNotice(error instanceof ServiceUnavailableError?'El seguimiento de personas requiere la activación pendiente del servicio.':'No se pudo consultar el seguimiento de esta persona.');
  });return()=>{++epoch.current;};
 },[targetId,userId,revision]);
 if(targetId===userId)return null;
 return <div className="space-y-2" role="group" aria-label="Seguimiento de personas" aria-busy={busy}>
  {following===null?<><p role="status" className="text-xs">{notice||'Consultando seguimiento de esta persona…'}</p>{notice&&<button onClick={()=>setRevision(v=>v+1)}>Revisar seguimiento de persona</button>}</>:<>
   <button disabled={busy||(blocked&&!following)} onClick={()=>{
    if(pending.current)return;pending.current=true;setBusy(true);setNotice('');const version=epoch.current;
    void communityCall('set_user_follow',{p_target:targetId,p_follow:!following}).then(value=>{if(version===epoch.current){setFollowing(value);setNotice(value?'Seguirás sus nuevas publicaciones.':'Dejaste de seguir a esta persona.');}}).catch(()=>{if(version===epoch.current)setNotice('No se pudo confirmar el cambio de seguimiento.');}).finally(()=>{pending.current=false;if(version===epoch.current)setBusy(false);});
   }}>{following?'Dejar de seguir a esta persona':'Seguir a esta persona'}</button>
   <p className="text-xs">Este seguimiento avisa de nuevas publicaciones; seguir una publicación avisa de sus cambios de estado. Los bloqueos impiden los avisos.</p>
   {notice&&<p role="status">{notice}</p>}
  </>}
 </div>;
}
