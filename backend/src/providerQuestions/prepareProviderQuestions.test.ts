import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "../domain/conversation.js";
import type { Fact } from "../domain/evidence.js";
import type { ProviderCandidate } from "../domain/provider.js";
import { prepareProviderQuestions, type AnalyzeFn, type PhraseFn } from "./prepareProviderQuestions.js";
import type { ProviderGap } from "./types.js";

function candidate(): ProviderCandidate {
  return { url: "https://example.com/provider", fields: {} };
}

function fact<T>(value: T): Fact<T> {
  return {
    value,
    source: "test",
    sourceUrl: "https://example.com/source",
    retrievedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("prepareProviderQuestions", () => {
  it("calls analyze then phrase with the right arguments and returns the phrased questions", async () => {
    const c = candidate();
    const state = createInitialState("s1");
    const gaps: ProviderGap[] = [{ topic: "availability", description: "Confirm availability." }];

    const analyze: AnalyzeFn = vi.fn(() => gaps);
    const phrase: PhraseFn = vi.fn(async () => ["Are you available?"]);

    const result = await prepareProviderQuestions({ candidate: c, state, analyze, phrase });

    expect(analyze).toHaveBeenCalledWith({ candidate: c, state });
    expect(phrase).toHaveBeenCalledWith({ candidate: c, gaps, state });
    expect(result).toEqual(["Are you available?"]);
  });

  it("passes an empty gap list through to phrase and returns []", async () => {
    const c = candidate();
    const state = createInitialState("s1");

    const analyze: AnalyzeFn = vi.fn(() => []);
    const phrase: PhraseFn = vi.fn(async () => []);

    const result = await prepareProviderQuestions({ candidate: c, state, analyze, phrase });

    expect(phrase).toHaveBeenCalledWith({ candidate: c, gaps: [], state });
    expect(result).toEqual([]);
  });

  it("propagates an error thrown by analyze, without calling phrase", async () => {
    const c = candidate();
    const state = createInitialState("s1");

    const analyze: AnalyzeFn = () => {
      throw new Error("analyze failed");
    };
    const phrase: PhraseFn = vi.fn(async () => []);

    await expect(prepareProviderQuestions({ candidate: c, state, analyze, phrase })).rejects.toThrow(
      "analyze failed",
    );
    expect(phrase).not.toHaveBeenCalled();
  });

  it("propagates an error thrown by phrase", async () => {
    const c = candidate();
    const state = createInitialState("s1");
    const gaps: ProviderGap[] = [{ topic: "pricing", description: "Confirm pricing." }];

    const analyze: AnalyzeFn = () => gaps;
    const phrase: PhraseFn = async () => {
      throw new Error("phrase failed");
    };

    await expect(prepareProviderQuestions({ candidate: c, state, analyze, phrase })).rejects.toThrow(
      "phrase failed",
    );
  });

  it("end-to-end with real analyze + fake phrase across a candidate with multiple gaps", async () => {
    const c: ProviderCandidate = {
      url: "https://example.com/provider",
      fields: {},
    };
    const state = {
      ...createInitialState("s1"),
      coreAttributes: { dateTime: "Saturday" },
      categoryAttributes: {
        waterSlide: { description: "water slide", importance: "required" as const, value: "water slide" },
        budget: { description: "budget", importance: "required" as const, value: "$500" },
      },
    };

    const phrase: PhraseFn = vi.fn(async ({ gaps }) => gaps.map((g) => `Question about ${g.topic}`));

    const result = await prepareProviderQuestions({ candidate: c, state, phrase });

    expect(result).toEqual([
      "Question about availability",
      "Question about requirementFit",
      "Question about pricing",
    ]);
  });

  it("realistic scenario: provider already has most info, exactly one required attribute is missing — real analyze + real gap-driven phrasing", async () => {
    const c: ProviderCandidate = {
      url: "https://example.com/provider",
      fields: {
        availability: fact("Available Saturday, October 17 from 1-5 PM"),
        pricing: fact("$350, includes setup and teardown"),
        servicesOffered: fact(["water slide included", "large tents available"]),
      },
    };
    const state = {
      ...createInitialState("s1"),
      coreAttributes: { dateTime: "Saturday, October 17 from 1-5 PM" },
      categoryAttributes: {
        waterSlide: { description: "water slide", importance: "required" as const, value: "water slide" },
        size: { description: "size", importance: "required" as const, value: "large" },
        ageRange: { description: "ages of children", importance: "required" as const, value: "ages 4-6" },
        budget: { description: "budget", importance: "required" as const, value: "$500" },
      },
    };

    const phrase: PhraseFn = vi.fn(async ({ gaps }) =>
      gaps.map((g) => `Question about ${g.topic}: ${g.description}`),
    );

    const result = await prepareProviderQuestions({ candidate: c, state, phrase });

    // Exactly one gap reached the phrasing step (availability, pricing, waterSlide,
    // size, and budget are all already known — only ageRange is missing).
    expect(phrase).toHaveBeenCalledWith({
      candidate: c,
      gaps: [
        expect.objectContaining({ topic: "requirementFit", description: expect.stringContaining("ageRange") }),
      ],
      state,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("ageRange");
  });
});
