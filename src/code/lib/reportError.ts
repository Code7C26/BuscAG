export function reportError(event: string, error?: unknown): void {
  const code = (error as {code?: unknown})?.code;
  console.error(event, typeof code === 'string' && /^[A-Z0-9_]{1,40}$/i.test(code) ? { code } : {});
}
