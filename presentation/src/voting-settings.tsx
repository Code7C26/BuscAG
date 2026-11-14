import React,{useState} from 'react';
import {api,Live} from './store';
import {httpsOrigin, safeLink} from '../server/public-links.mjs';
export function VotingSettings({live}:{live:Live|null}){
 const[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[state,setState]=useState<NonNullable<Live['voting']>|null>(null);
 React.useEffect(()=>{let active=true;const update=()=>api<NonNullable<Live['voting']>>('/api/admin/voting').then(v=>active&&setState(v)).catch(()=>{});update();const timer=setInterval(update,1500);return()=>{active=false;clearInterval(timer);};},[]);
 const current=state||live?.voting,pair=current?.pairing;
 async function start(){setBusy(true);setMessage('');try{setState(await api('/api/admin/voting/connect','POST',{}));}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <section className="panel voting-settings"><h3>Encuestas en vivo</h3><p>{current?.connected?'Conectado y sincronizando':current?.configured?'Configurado · revisá la conexión a Internet':'Conectá tu computadora sin copiar contraseñas'}</p>
 <button disabled={busy} onClick={start}>{busy?'Preparando conexión…':current?.configured?'Volver a conectar encuestas':'Conectar encuestas'}</button>
 {pair?.phase==='pending'&&<div role="status"><p>1. Abrí la página privada e iniciá sesión con tu cuenta propietaria de ChatGPT.</p><a className="btn" href={pair.url} target="_blank" rel="noopener noreferrer">Abrir autorización privada</a><p>2. Compará este código y autorizá sólo si coincide:</p><strong style={{fontSize:40,letterSpacing:8}}>{pair.code}</strong><p>Vence en cinco minutos. 3. Volvé acá: la conexión se completa sola.</p><button onClick={async()=>{await api('/api/admin/voting/connect','DELETE');setState(await api('/api/admin/voting'));}}>Cancelar conexión</button></div>}
 {pair?.error&&<p role="alert">{pair.error}</p>}
 {current?.configured&&<><p>En el presentador, pulsá Usar votos reales en celulares o HTTPS y después Abrir. Verificá ABIERTA EN CELULARES. Cerrala antes de mostrar resultados.</p><button onClick={async()=>{try{await api('/api/admin/voting/disconnect','POST',{});setState(await api('/api/admin/voting'));}catch{setMessage('No se pudo revocar la conexión. Revisá Internet y reintentá.');}}}>Desconectar esta computadora</button></>}
 <small>Credencial cifrada, guardada sólo en el servidor de esta PC. No aparece en el navegador ni se incluye al exportar. No compartas la página privada de autorización.</small><p role="status">{message}</p></section>;
}
export function LinkCheck({value,label}:{value:string;label:string}){return <p className={safeLink(value)?'link-valid':'warning'}>{label}: {safeLink(value)?'HTTPS válido para QR':'pendiente · se requiere una URL HTTPS pública'}{value==='https://github.com/Code7C26/BuscAG'&&<small>Repositorio privado: requiere una cuenta con acceso. El QR no cambia los permisos.</small>}</p>;}
