/**
 * Runs `fn` over `items` with at most `limit` calls in flight at once,
 * returning results in the same order as `items` regardless of which
 * call finishes first. `fn` is expected to catch its own per-item
 * errors (as every current call site does) — if `fn` rejects, that
 * rejection propagates out of `mapWithConcurrency` immediately
 * (fail-fast, standard `Promise.all` semantics), it does not isolate
 * other in-flight items.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]!, current);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
