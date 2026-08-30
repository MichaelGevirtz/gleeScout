// Hand-written mirror of the backend's Zod-inferred shapes
// (backend/src/domain/*.ts, backend/src/ranking/types.ts). The
// frontend does not re-validate already-server-validated JSON, so
// these are plain types, not Zod schemas.

export type ConversationPhase = "gathering" | "ready_for_search";

export interface CoreAttributes {
  dateTime?: string;
  location?: string;
}

export interface CategoryAttributeSlot {
  description: string;
  importance: "required" | "optional";
  value: string | null;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationState {
  sessionId: string;
  phase: ConversationPhase;
  serviceCategory: string | null;
  coreAttributes: CoreAttributes;
  categoryAttributes: Record<string, CategoryAttributeSlot>;
  messages: Message[];
}

export interface Fact<T> {
  value: T;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
}

export type SourceType = "google" | "yelp" | "provider_website" | "directory" | "other";

export interface Inferred<T> {
  value: T;
  evidenceSourceUrl: string;
  evidenceExcerpt?: string;
  sourceType: SourceType;
  retrievedAt: string;
}

export interface Simulated<T> {
  value: T;
  generatedAt: string;
}

export interface ProviderCandidateFields {
  name?: Fact<string>;
  location?: Fact<string>;
  servicesOffered?: Fact<string[]>;
  pricing?: Fact<string>;
  availability?: Fact<string>;
  rating?: Fact<number>;
  reviewCount?: Fact<number>;
  photos?: Fact<string[]>;
  policies?: Fact<string>;
  contactMethod?: Fact<string>;
}

export interface ProviderCandidate {
  url: string;
  fields: ProviderCandidateFields;
  inferred?: Inferred<string>[];
  reputationRating?: number;
  reputationReviewCount?: number;
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

export interface SimulatedAnswer {
  question: string;
  answer: Simulated<string>;
}

export interface TraceEvent {
  step: string;
  summary: string;
  detail?: Record<string, unknown>;
  timestamp: string;
}
