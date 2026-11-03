/** Only an unambiguously absent capability allows legacy client notices.
 * An unknown outcome must not duplicate notifications owned by the backend. */
export async function needsLegacyMatchNotice(read:()=>PromiseLike<{
  data:{queued_match_notifications:boolean}|null;error:{code?:string}|null;
}>) {
  try {
    const {error}=await read();
    return error?.code==='PGRST202';
  } catch { return false; }
}
