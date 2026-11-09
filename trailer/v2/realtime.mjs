// Local demonstration transport only. Phoenix v1/v2 join acknowledgements must
// echo the requested postgres_changes filters; no remote socket is opened.
export function demoSocketReply(raw){
 const packet=JSON.parse(String(raw)),array=Array.isArray(packet);
 const [join_ref,ref,topic,event,payload]=array?packet:[packet.join_ref,packet.ref,packet.topic,packet.event,packet.payload];
 if(event!=='phx_join'&&event!=='heartbeat')return null;
 const response={status:'ok',response:event==='phx_join'?{postgres_changes:(payload?.config?.postgres_changes??[]).map((binding,i)=>({...binding,id:i+1}))}:{}};
 return JSON.stringify(array?[join_ref,ref,topic,'phx_reply',response]:{join_ref,ref,topic,event:'phx_reply',payload:response});
}
