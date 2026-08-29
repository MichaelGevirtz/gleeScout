import { buildProviderSearchQuery } from "../research/searchQuery.js";
import { discoverProviderCandidates } from "../research/discoverProviderCandidates.js";
import { enrichProviderCandidates } from "../research/enrichProviderCandidates.js";
import { rankProviders } from "../ranking/rankProviders.js";
import { deriveRankingRequirements } from "../ranking/types.js";
import type { ConversationState } from "../domain/conversation.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { ProviderScore, RankingRequirements } from "../ranking/types.js";
import type { TraceEvent } from "../domain/trace.js";

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

export interface GenerateProviderListResult {
  providers: ProviderScore[];
  trace: TraceEvent[];
}

function candidateLabel(candidate: ProviderCandidate): string {
  return candidate.fields.name?.value ?? new URL(candidate.url).hostname;
}

export async function generateProviderList({
  state,
  discover = discoverProviderCandidates,
  enrich = enrichProviderCandidates,
  rank = rankProviders,
}: GenerateProviderListParams): Promise<GenerateProviderListResult> {
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
  const location = coreAttributes.location;

  const query = buildProviderSearchQuery({ serviceCategory, location });

  const discoverStartedAt = Date.now();
  const discovered = await discover({ serviceCategory, location });
  const discoverEndedAt = Date.now();

  const enriched = await enrich({ candidates: discovered });
  const enrichEndedAt = Date.now();

  const providers = rank({ candidates: enriched, requirements: deriveRankingRequirements(state) });
  const rankEndedAt = Date.now();

  const enrichedWithSignal = enriched.filter(
    (c) => Array.isArray(c.inferred) && c.inferred.length > 0
  ).length;
  const enrichedNoSignalFound = enriched.filter(
    (c) => Array.isArray(c.inferred) && c.inferred.length === 0
  ).length;
  const notEnriched = enriched.length - enrichedWithSignal - enrichedNoSignalFound;

  const trace: TraceEvent[] = [
    {
      step: "discover",
      summary: `Searched for "${serviceCategory}" providers in ${location}`,
      detail: { query, candidatesFound: discovered.length },
      timestamp: new Date(discoverEndedAt).toISOString(),
      durationMs: discoverEndedAt - discoverStartedAt,
    },
    {
      step: "enrich",
      summary: "Enriched candidates with review signal where available",
      detail: { enrichedWithSignal, enrichedNoSignalFound, notEnriched },
      timestamp: new Date(enrichEndedAt).toISOString(),
      durationMs: enrichEndedAt - discoverEndedAt,
    },
    {
      step: "rank",
      summary:
        "Ranked providers by requirement match, geographic fit, price fit, reputation, and evidence quality",
      detail: {
        scores: providers.map((p) => ({
          provider: candidateLabel(p.candidate),
          score: p.score,
          dimensionScores: p.dimensionScores,
        })),
      },
      timestamp: new Date(rankEndedAt).toISOString(),
      durationMs: rankEndedAt - enrichEndedAt,
    },
    {
      step: "recommend",
      summary: `Selected top ${providers.length} provider${providers.length === 1 ? "" : "s"} to present`,
      detail: { count: providers.length },
      timestamp: new Date(rankEndedAt).toISOString(),
      durationMs: 0,
    },
  ];

  return { providers, trace };
}
