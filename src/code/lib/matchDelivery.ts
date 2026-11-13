/** An absent capability or explicitly disabled backend permits legacy notices.
 * An unknown outcome must not duplicate notifications owned by the backend. */
export async function needsLegacyMatchNotice(read:()=>PromiseLike<{
  data:{queued_match_notifications:boolean}|null;error:{code?:string}|null;
}>) {
  try {
    const {data,error}=await read();
    return error?.code==='PGRST202'||(!error&&data?.queued_match_notifications===false);
  } catch { return false; }
}
