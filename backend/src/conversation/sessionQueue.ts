const queue = new Map<string, Promise<void>>();

export async function runSerialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prior = queue.get(key) ?? Promise.resolve();
  const chained = prior.catch(() => undefined).then(fn);
  const settled = chained.then(
    () => undefined,
    () => undefined
  );

  queue.set(key, settled);
  settled.then(() => {
    if (queue.get(key) === settled) {
      queue.delete(key);
    }
  });

  return chained;
}

/** Test-only inspection hook — not used by production code. */
export function __hasEntryForTesting(key: string): boolean {
  return queue.has(key);
}
