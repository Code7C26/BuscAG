/** Acknowledge only the captured visible IDs and only after the database confirms
 * them. Small batches avoid oversized REST URLs and API row-limit truncation. */
export async function persistReadReceipts(ids:string[],update:(ids:string[])=>PromiseLike<{
  data:{id:string}[]|null;error:unknown;
}>,isCurrent:()=>boolean,onConfirmed:(ids:Set<string>)=>void) {
  const unique=[...new Set(ids)];
  for(let offset=0;offset<unique.length;offset+=100){
    if(!isCurrent()) return;
    const batch=unique.slice(offset,offset+100);
    const {data,error}=await update(batch);
    if(!isCurrent()) return;
    if(error) throw error;
    if(!Array.isArray(data)) throw new Error('No se pudo confirmar el estado de lectura.');
    const requested=new Set(batch);
    onConfirmed(new Set(data.filter(row=>requested.has(row.id)).map(row=>row.id)));
  }
}
