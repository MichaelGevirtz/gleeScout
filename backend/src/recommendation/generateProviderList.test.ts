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
    expect(result).toBe(ranked);
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
