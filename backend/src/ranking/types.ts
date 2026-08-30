import type { CategoryAttributeSlot, ConversationState } from "../domain/conversation.js";
import type { ProviderCandidate } from "../domain/provider.js";

export interface RankingRequirements {
  serviceCategory?: string;
  location?: string;
  categoryAttributes: Record<string, CategoryAttributeSlot>;
}

export function deriveRankingRequirements(state: ConversationState): RankingRequirements {
  return {
    serviceCategory: state.serviceCategory ?? undefined,
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

export type ConfirmedRequirementKind = "serviceCategory" | "location" | "categoryAttribute";

export interface ConfirmedRequirement {
  label: string;
  kind: ConfirmedRequirementKind;
}

export type OtherProviderFactKind =
  | "location"
  | "servicesOffered"
  | "pricing"
  | "availability"
  | "policies"
  | "contactMethod";

export interface OtherProviderFact {
  kind: OtherProviderFactKind;
  value: string;
}

export interface ProviderScore {
  candidate: ProviderCandidate;
  score: number;
  dimensionScores: Record<RankingDimension, number | null>;
  explanation: string;
  fitScore: number | null;
  matchGrade: MatchGrade;
  confirmedRequirements: ConfirmedRequirement[];
  otherFacts: OtherProviderFact[];
}
