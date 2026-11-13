/** Focus/visibility storms share a cooldown; reconnects always reconcile the gap.
 * The resource queue owns serialization and coalescing, including realtime events. */
export function createReconnectSync(refresh:()=>Promise<void>,isCurrent:()=>boolean,now:()=>number=Date.now) {
  let last=-Infinity;
  return async (force=false)=>{
    if(!isCurrent()) return;
    const time=now();
    if(!force&&time-last<15_000) return;
    last=time;
    try {await refresh();}
    catch(error){last=-Infinity;throw error;}
  };
}
