import {createStorageObjectId} from './storageObjectId';
export type PublicationInput={owner_id:string;title:string;description:string;category:string;status:string;location_name:string;lat:number;lng:number;date:string;image_url:string;reward?:string|null};
type Payload=Omit<PublicationInput,'owner_id'>;
type Result<Row>={data:Row|null;error:{code?:string;message?:string}|null};
/** Account-scoped, memory-only intents. Unknown outcomes retain both the request
 * key and upload path; acknowledgement alone permits a new identical publication. */
export function createPublicationPublisher<Row>() {
  const intents=new Map<string,{requestKey:string;uploadKey:string;imageUrl?:string}>();
  const pending=new Map<string,Promise<Row>>();
  return {
    publish(input:PublicationInput,transport:{
      upload:(key:string)=>Promise<string>;
      rpc:(args:{p_request_key:string;p_payload:Payload})=>PromiseLike<Result<Row>>;
      legacy:(input:PublicationInput)=>PromiseLike<Result<Row>>;
      isCurrent:()=>boolean;
    }):Promise<Row> {
      if(!transport.isCurrent()) return Promise.reject(new Error('La sesión cambió.'));
      const signature=JSON.stringify(input);const running=pending.get(signature);if(running) return running;
      let intent=intents.get(signature);
      if(!intent){intent={requestKey:createStorageObjectId(),uploadKey:createStorageObjectId()};intents.set(signature,intent);}
      const selected=intent;
      const request=Promise.resolve().then(async()=>{
        try {
          if(!transport.isCurrent()) throw new Error('La sesión cambió.');
          if(!selected.imageUrl) selected.imageUrl=await transport.upload(selected.uploadKey);
          if(!transport.isCurrent()) throw new Error('La sesión cambió.');
          const prepared={...input,image_url:selected.imageUrl};
          const {owner_id:_,...payload}=prepared;
          let result=await transport.rpc({p_request_key:selected.requestKey,p_payload:payload});
          if(!transport.isCurrent()) throw new Error('La sesión cambió.');
          if(result.error?.code==='PGRST202') result=await transport.legacy(prepared);
          if(!transport.isCurrent()) throw new Error('La sesión cambió.');
          if(result.error) throw result.error;
          if(!result.data) throw new Error('No se pudo confirmar la publicación.');
          intents.delete(signature);return result.data;
        } finally {pending.delete(signature);}
      });
      pending.set(signature,request);return request;
    }
  };
}
