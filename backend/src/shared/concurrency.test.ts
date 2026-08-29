import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./concurrency.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("mapWithConcurrency", () => {
  it("returns one result per item, in input order, regardless of completion order", async () => {
    const items = [30, 10, 20];
    const fn = async (ms: number) => {
      await delay(ms);
      return ms;
    };

    const results = await mapWithConcurrency(items, 3, fn);

    expect(results).toEqual([30, 10, 20]);
  });

  it("never runs more than `limit` calls concurrently, and does use concurrency (not one at a time)", async () => {
    const items = Array.from({ length: 6 }, (_, i) => i);
    let inFlight = 0;
    let maxInFlight = 0;
    const fn = async (item: number) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(5);
      inFlight--;
      return item;
    };

    const results = await mapWithConcurrency(items, 3, fn);

    expect(results).toEqual(items);
    expect(maxInFlight).toBe(3);
  });

  it("starts new items in original array order, not completion order", async () => {
    const items = ["a", "b", "c"];
    const order: string[] = [];
    const delays: Record<string, number> = { a: 20, b: 5, c: 5 };
    const fn = async (item: string) => {
      order.push(`start:${item}`);
      await delay(delays[item]!);
      order.push(`end:${item}`);
      return item;
    };

    await mapWithConcurrency(items, 3, fn);

    expect(order.filter((entry) => entry.startsWith("start:"))).toEqual([
      "start:a",
      "start:b",
      "start:c",
    ]);
  });

  it("propagates a rejection from fn out of mapWithConcurrency", async () => {
    const items = [1, 2, 3];
    const fn = async (item: number) => {
      if (item === 2) throw new Error("boom");
      return item;
    };

    await expect(mapWithConcurrency(items, 3, fn)).rejects.toThrow("boom");
  });

  it("processes all items when limit exceeds the item count", async () => {
    const items = [1, 2];
    const fn = async (item: number) => item * 2;

    const results = await mapWithConcurrency(items, 10, fn);

    expect(results).toEqual([2, 4]);
  });
});
