export type ProviderGapTopic = "availability" | "requirementFit" | "pricing";

export interface ProviderGap {
  topic: ProviderGapTopic;
  description: string;
}
