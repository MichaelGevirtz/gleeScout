import { discoverProviderCandidates } from "../research/discoverProviderCandidates.js";
import { enrichProviderCandidates } from "../research/enrichProviderCandidates.js";
import { rankProviders } from "../ranking/rankProviders.js";
import { deriveRankingRequirements } from "../ranking/types.js";
import type { ConversationState } from "../domain/conversation.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { ProviderScore, RankingRequirements } from "../ranking/types.js";

export type DiscoverFn = (params: {
  serviceCategory: string;
  location: string;
}) => Promise<ProviderCandidate[]>;

export type EnrichFn = (params: { candidates: ProviderCandidate[] }) => Promise<ProviderCandidate[]>;

export type RankFn = (params: {
  candidates: ProviderCandidate[];
  requirements: RankingRequirements;
}) => ProviderScore[];

export interface GenerateProviderListParams {
  state: ConversationState;
  /** Injected discovery call; defaults to Task 20's real discoverProviderCandidates. */
  discover?: DiscoverFn;
  /** Injected enrichment call; defaults to Task 25's real enrichProviderCandidates. */
  enrich?: EnrichFn;
  /** Injected ranking call; defaults to Task 32's real rankProviders. */
  rank?: RankFn;
}

export async function generateProviderList({
  state,
  discover = discoverProviderCandidates,
  enrich = enrichProviderCandidates,
  rank = rankProviders,
}: GenerateProviderListParams): Promise<ProviderScore[]> {
  const { serviceCategory, coreAttributes } = state;
  if (serviceCategory === null) {
    throw new Error(
      "generateProviderList: state.serviceCategory is null. This should never happen for a session in phase 'ready_for_search'."
    );
  }
  if (coreAttributes.location === undefined) {
    throw new Error(
      "generateProviderList: state.coreAttributes.location is undefined. This should never happen for a session in phase 'ready_for_search'."
    );
  }

  const candidates = await discover({ serviceCategory, location: coreAttributes.location });
  const enriched = await enrich({ candidates });
  return rank({ candidates: enriched, requirements: deriveRankingRequirements(state) });
}
