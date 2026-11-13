import { createStorageObjectId } from './storageObjectId';

/** Retain unknown-outcome attempts within the current account, never in shared storage. */
export function createMessageIntents() {
  const keys = new Map<string,string>();
  return {
    key(thread: string) { let key=keys.get(thread); if (!key) { key=createStorageObjectId();keys.set(thread,key); } return key; },
    acknowledge(thread: string) { keys.delete(thread); }
  };
}
export type MessageInput = { item_id:string;sender_id:string;recipient_id:string;sender_name:string;sender_avatar:string;item_title:string;item_image:string;text:string };
type Result<Row> = {data:Row|null;error:{code?:string;message?:string}|null};
export async function deliverMessage<Row>(input:MessageInput,requestKey:string,transport:{
  rpc:(args:{p_request_key:string;p_item_id:string;p_recipient_id:string;p_text:string})=>PromiseLike<Result<Row>>;
  legacy:(input:MessageInput)=>PromiseLike<Result<Row>>;
  allowLegacy?:boolean;
  isCurrent:()=>boolean;
}):Promise<Row> {
  if (!transport.isCurrent()) throw new Error('La sesión cambió.');
  let result=await transport.rpc({p_request_key:requestKey,p_item_id:input.item_id,p_recipient_id:input.recipient_id,p_text:input.text});
  if (!transport.isCurrent()) throw new Error('La sesión cambió.');
  // PGRST202 means no matching function was executed. Never fall back on a timeout,
  // HTTP error, RLS failure or a lost response: the transaction might have committed.
  if (result.error?.code==='PGRST202'&&transport.allowLegacy!==false) result=await transport.legacy(input);
  if (!transport.isCurrent()) throw new Error('La sesión cambió.');
  if (result.error) {
    if (result.error.message==='message_rate_limited') throw new Error('Espera un momento antes de enviar más mensajes.');
    throw result.error;
  }
  if (!result.data) throw new Error('No se pudo confirmar el mensaje.');
  return result.data;
}
