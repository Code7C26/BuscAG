/** Independent server-only webhook/scheduler credentials, never a VITE value. */
export function usableServerSecret(value:unknown):value is string {
  return typeof value==='string'&&value.length>=32&&value.length<=512;
}
export async function sameServerSecret(actual:string,expected:string):Promise<boolean> {
  if(actual.length>512||!usableServerSecret(expected))return false;
  const encoder=new TextEncoder();
  const [a,b]=await Promise.all([actual,expected].map(value=>crypto.subtle.digest('SHA-256',encoder.encode(value))));
  const left=new Uint8Array(a);const right=new Uint8Array(b);let difference=0;
  for(let index=0;index<left.length;index++)difference|=left[index]^right[index];
  return difference===0;
}
