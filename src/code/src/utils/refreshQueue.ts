/** Coalesce events and serialize reads so older responses cannot overwrite newer data. */
export function createRefreshQueue<Key extends string>(refresh: (keys: Set<Key>) => Promise<void>) {
  const pending = new Set<Key>();
  let running: Promise<void> | null = null;
  return {
    request(...keys: Key[]): Promise<void> {
      keys.forEach(key => pending.add(key));
      if (!running) running = Promise.resolve().then(async () => {
        try {
          while (pending.size) {
            const batch = new Set(pending); pending.clear();
            await refresh(batch);
          }
        } finally { running = null; }
      });
      return running;
    }
  };
}
