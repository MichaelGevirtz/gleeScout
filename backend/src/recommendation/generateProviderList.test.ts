import { describe, expect, it, vi } from "vitest";
import { createInitialState, type ConversationState } from "../domain/conversation.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { ProviderScore } from "../ranking/types.js";
import {
  generateProviderList,
  type DiscoverFn,
  type EnrichFn,
  type RankFn,
} from "./generateProviderList.js";
import { computeMockReputation } from "./mockReputationSignals.js";

function readyState(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    ...createInitialState("s1"),
    serviceCategory: "bounce house rental",
    coreAttributes: { dateTime: "next Saturday", location: "Austin, TX" },
    ...overrides,
  };
}

function candidate(url: string): ProviderCandidate {
  return { url, fields: {} };
}

describe("generateProviderList", () => {
  it("calls discover, then enrich with discover's result, then rank with enrich's result and derived requirements, returning rank's result unchanged", async () => {
    const discovered = [candidate("https://a.example")];
    const enriched = [candidate("https://a.example"), candidate("https://b.example")];
    const ranked: ProviderScore[] = [
      {
        candidate: enriched[0]!,
        score: 0.8,
        dimensionScores: {
          requirementMatch: null,
          geoFit: null,
          priceFit: null,
          reputation: null,
          evidenceQuality: 0,
        },
        explanation: "test explanation",
        fitScore: null,
        matchGrade: "insufficient_data",
      },
    ];

    let capturedDiscoverParams: { serviceCategory: string; location: string } | undefined;
    let capturedEnrichCandidates: ProviderCandidate[] | undefined;
    let capturedRankParams:
      | { candidates: ProviderCandidate[]; requirements: unknown }
      | undefined;

    const discover: DiscoverFn = async (params) => {
      capturedDiscoverParams = params;
      return discovered;
    };
    const enrich: EnrichFn = async ({ candidates }) => {
      capturedEnrichCandidates = candidates;
      return enriched;
    };
    const rank: RankFn = (params) => {
      capturedRankParams = params;
      return ranked;
    };

    const state = readyState({
      categoryAttributes: {
        waterSlide: { description: "whether a water slide is wanted", importance: "optional", value: null },
      },
    });

    const result = await generateProviderList({ state, discover, enrich, rank });

    expect(capturedDiscoverParams).toEqual({ serviceCategory: "bounce house rental", location: "Austin, TX" });
    expect(capturedEnrichCandidates).toEqual(discovered);
    expect(capturedRankParams?.candidates).toEqual(enriched);
    expect(capturedRankParams?.requirements).toEqual({
      location: "Austin, TX",
      categoryAttributes: state.categoryAttributes,
    });
    expect(result.providers).toEqual([
      {
        ...ranked[0],
        candidate: { ...ranked[0]!.candidate, ...computeMockReputation(ranked[0]!.candidate.url) },
      },
    ]);
  });

  it("attaches deterministic mock reputation to each candidate without altering rank's score/dimensionScores/fitScore/matchGrade/order", async () => {
    const candidateA = candidate("https://a.example");
    const candidateB = candidate("https://b.example");
    const ranked: ProviderScore[] = [
      {
        candidate: candidateA,
        score: 0.9,
        dimensionScores: {
          requirementMatch: 0.9,
          geoFit: 1,
          priceFit: 0.8,
          reputation: null,
          evidenceQuality: 0.8,
        },
        explanation: "top match",
        fitScore: 0.9,
        matchGrade: "wonderful",
      },
      {
        candidate: candidateB,
        score: 0.5,
        dimensionScores: {
          requirementMatch: 0.5,
          geoFit: 0.5,
          priceFit: 0.5,
          reputation: null,
          evidenceQuality: 0.5,
        },
        explanation: "average match",
        fitScore: 0.5,
        matchGrade: "average",
      },
    ];

    const discover: DiscoverFn = async () => [candidateA, candidateB];
    const enrich: EnrichFn = async ({ candidates }) => candidates;
    const rank: RankFn = () => ranked;

    const { providers } = await generateProviderList({ state: readyState(), discover, enrich, rank });

    expect(providers.map((p) => p.candidate.url)).toEqual([candidateA.url, candidateB.url]);
    for (let i = 0; i < providers.length; i++) {
      const { candidate: _candidate, ...rest } = providers[i]!;
      const { candidate: _originalCandidate, ...expectedRest } = ranked[i]!;
      expect(rest).toEqual(expectedRest);

      const expectedReputation = computeMockReputation(ranked[i]!.candidate.url);
      expect(providers[i]!.candidate.reputationRating).toBe(expectedReputation.reputationRating);
      expect(providers[i]!.candidate.reputationReviewCount).toBe(expectedReputation.reputationReviewCount);
    }
  });

  it("returns a trace describing discovery, enrichment, and ranking", async () => {
    const withSignal = { ...candidate("https://a.example"), inferred: [{ value: "great with kids", evidenceSourceUrl: "https://reviews.example", sourceType: "google" as const, retrievedAt: "2026-08-28T00:00:00.000Z" }] };
    const noSignalFound = { ...candidate("https://b.example"), inferred: [] };
    const notEnriched = candidate("https://c.example");
    const enriched = [withSignal, noSignalFound, notEnriched];
    const ranked: ProviderScore[] = [
      {
        candidate: withSignal,
        score: 0.75,
        dimensionScores: {
          requirementMatch: 0.8,
          geoFit: 1,
          priceFit: 0.7,
          reputation: 0.9,
          evidenceQuality: 0.8,
        },
        explanation: "test explanation",
        fitScore: 0.833,
        matchGrade: "wonderful",
      },
    ];

    const discover: DiscoverFn = async () => [withSignal, noSignalFound, notEnriched];
    const enrich: EnrichFn = async () => enriched;
    const rank: RankFn = () => ranked;

    const state = readyState();
    const { trace } = await generateProviderList({ state, discover, enrich, rank });

    const discoverEvent = trace.find((e) => e.step === "discover");
    expect(discoverEvent?.detail).toEqual({
      query: expect.stringContaining("Austin, TX"),
      candidatesFound: 3,
    });

    const enrichEvent = trace.find((e) => e.step === "enrich");
    expect(enrichEvent?.detail).toEqual({
      enrichedWithSignal: 1,
      enrichedNoSignalFound: 1,
      notEnriched: 1,
    });

    const rankEvent = trace.find((e) => e.step === "rank");
    expect(rankEvent?.detail).toEqual({
      scores: [
        {
          provider: "a.example",
          score: 0.75,
          dimensionScores: ranked[0]!.dimensionScores,
          fitScore: ranked[0]!.fitScore,
          matchGrade: ranked[0]!.matchGrade,
          explanation: ranked[0]!.explanation,
        },
      ],
    });

    const recommendEvent = trace.find((e) => e.step === "recommend");
    expect(recommendEvent?.detail).toEqual({ count: 1 });
  });

  it("gives each trace event real per-step timing instead of one shared timestamp", async () => {
    const discover: DiscoverFn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return [candidate("https://a.example")];
    };
    const enrich: EnrichFn = async ({ candidates }) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return candidates;
    };
    const rank: RankFn = ({ candidates }) =>
      candidates.map((c) => ({
        candidate: c,
        score: 1,
        dimensionScores: {
          requirementMatch: null,
          geoFit: null,
          priceFit: null,
          reputation: null,
          evidenceQuality: null,
        },
        explanation: "test",
        fitScore: null,
        matchGrade: "insufficient_data",
      }));

    const { trace } = await generateProviderList({ state: readyState(), discover, enrich, rank });

    const discoverEvent = trace.find((e) => e.step === "discover")!;
    const enrichEvent = trace.find((e) => e.step === "enrich")!;
    const rankEvent = trace.find((e) => e.step === "rank")!;
    const recommendEvent = trace.find((e) => e.step === "recommend")!;

    for (const event of trace) {
      expect(typeof event.durationMs).toBe("number");
      expect(event.durationMs!).toBeGreaterThanOrEqual(0);
    }

    expect(discoverEvent.timestamp <= enrichEvent.timestamp).toBe(true);
    expect(enrichEvent.timestamp <= rankEvent.timestamp).toBe(true);
    expect(rankEvent.timestamp).toBe(recommendEvent.timestamp);
    expect(discoverEvent.timestamp).not.toBe(enrichEvent.timestamp);

    expect(discoverEvent.durationMs!).toBeGreaterThanOrEqual(15);
    expect(enrichEvent.durationMs!).toBeGreaterThanOrEqual(5);
    expect(recommendEvent.durationMs).toBe(0);
  });

  it("throws a clear error and never calls discover/enrich/rank when serviceCategory is null", async () => {
    const state = readyState({ serviceCategory: null });
    const discover = vi.fn();
    const enrich = vi.fn();
    const rank = vi.fn();

    await expect(
      generateProviderList({ state, discover, enrich, rank })
    ).rejects.toThrow();
    expect(discover).not.toHaveBeenCalled();
    expect(enrich).not.toHaveBeenCalled();
    expect(rank).not.toHaveBeenCalled();
  });

  it("throws a clear error and never calls discover/enrich/rank when location is undefined", async () => {
    const state = readyState({ coreAttributes: { dateTime: "next Saturday" } });
    const discover = vi.fn();
    const enrich = vi.fn();
    const rank = vi.fn();

    await expect(
      generateProviderList({ state, discover, enrich, rank })
    ).rejects.toThrow();
    expect(discover).not.toHaveBeenCalled();
    expect(enrich).not.toHaveBeenCalled();
    expect(rank).not.toHaveBeenCalled();
  });

  it("propagates a rejection from discover without swallowing it", async () => {
    const discover: DiscoverFn = async () => {
      throw new Error("discovery failed");
    };

    await expect(
      generateProviderList({ state: readyState(), discover, enrich: vi.fn(), rank: vi.fn() })
    ).rejects.toThrow("discovery failed");
  });

  it("propagates a rejection from enrich without swallowing it", async () => {
    const discover: DiscoverFn = async () => [];
    const enrich: EnrichFn = async () => {
      throw new Error("enrichment failed");
    };

    await expect(
      generateProviderList({ state: readyState(), discover, enrich, rank: vi.fn() })
    ).rejects.toThrow("enrichment failed");
  });

  it("propagates a synchronous throw from rank without swallowing it", async () => {
    const discover: DiscoverFn = async () => [];
    const enrich: EnrichFn = async () => [];
    const rank: RankFn = () => {
      throw new Error("ranking failed");
    };

    await expect(
      generateProviderList({ state: readyState(), discover, enrich, rank })
    ).rejects.toThrow("ranking failed");
  });
});
