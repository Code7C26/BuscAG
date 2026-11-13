/** Invalidate captured operations synchronously when their session/lifetime ends. */
export function createSessionGuard() {
  let revision = 0;
  let closed = false;
  return {
    invalidate() { revision += 1; },
    close() { closed = true; revision += 1; },
    capture() {
      const captured = revision;
      return () => !closed && captured === revision;
    }
  };
}
export type SessionGuard = ReturnType<typeof createSessionGuard>;
