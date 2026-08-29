import { describe, expect, it } from "vitest";
import { runSerialized, __hasEntryForTesting } from "./sessionQueue.js";

function createDeferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

describe("runSerialized", () => {
  it("runs two calls with the same key strictly sequentially", async () => {
    const order: string[] = [];
    const deferred = createDeferred<void>();

    const call1 = runSerialized("same-key", async () => {
      order.push("1-start");
      await deferred.promise;
      order.push("1-end");
    });
    const call2 = runSerialized("same-key", async () => {
      order.push("2-start");
      order.push("2-end");
    });

    await flushMicrotasks();
    // call2's fn must not have started yet — it can only start once call1's fn resolves,
    // and call1 is still awaiting `deferred`.
    expect(order).toEqual(["1-start"]);

    deferred.resolve();
    await call1;
    await call2;

    expect(order).toEqual(["1-start", "1-end", "2-start", "2-end"]);
  });

  it("runs calls with different keys concurrently", async () => {
    const order: string[] = [];
    const d1 = createDeferred<void>();
    const d2 = createDeferred<void>();

    const call1 = runSerialized("key-a", async () => {
      order.push("a-start");
      await d1.promise;
      order.push("a-end");
    });
    const call2 = runSerialized("key-b", async () => {
      order.push("b-start");
      await d2.promise;
      order.push("b-end");
    });

    await flushMicrotasks();
    expect(order).toContain("a-start");
    expect(order).toContain("b-start");
    expect(order).not.toContain("a-end");
    expect(order).not.toContain("b-end");

    d1.resolve();
    d2.resolve();
    await call1;
    await call2;
  });

  it("returns/rejects with that specific call's own fn result/error", async () => {
    const result = await runSerialized("distinct-key", async () => "value-a");
    expect(result).toBe("value-a");

    await expect(
      runSerialized("distinct-key", async () => {
        throw new Error("boom-a");
      })
    ).rejects.toThrow("boom-a");

    const result2 = await runSerialized("distinct-key", async () => "value-b");
    expect(result2).toBe("value-b");
  });

  it("does not let a rejection from one call block later calls for the same or a different key", async () => {
    await expect(
      runSerialized("rejecting-key", async () => {
        throw new Error("fail");
      })
    ).rejects.toThrow("fail");

    const sameKeyResult = await runSerialized("rejecting-key", async () => "still works");
    expect(sameKeyResult).toBe("still works");

    const differentKeyResult = await runSerialized("other-key", async () => "also works");
    expect(differentKeyResult).toBe("also works");
  });

  it("removes a settled entry from the internal map once nothing newer is chained after it", async () => {
    await runSerialized("cleanup-key", async () => "done");
    await flushMicrotasks();

    expect(__hasEntryForTesting("cleanup-key")).toBe(false);
  });
});
