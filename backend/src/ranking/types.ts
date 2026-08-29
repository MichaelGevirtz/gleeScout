import type { CategoryAttributeSlot, ConversationState } from "../domain/conversation.js";
import type { ProviderCandidate } from "../domain/provider.js";

export interface RankingRequirements {
  location?: string;
  categoryAttributes: Record<string, CategoryAttributeSlot>;
}

export function deriveRankingRequirements(state: ConversationState): RankingRequirements {
  return {
    location: state.coreAttributes.location,
    categoryAttributes: state.categoryAttributes,
  };
}

export type RankingDimension =
  | "requirementMatch"
  | "geoFit"
  | "priceFit"
  | "reputation"
  | "evidenceQuality";

export type MatchGrade = "wonderful" | "good" | "average" | "poor" | "insufficient_data";

export interface ProviderScore {
  candidate: ProviderCandidate;
  score: number;
  dimensionScores: Record<RankingDimension, number | null>;
  explanation: string;
  fitScore: number | null;
  matchGrade: MatchGrade;
}
