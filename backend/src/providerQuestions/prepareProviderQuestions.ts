import { analyzeProviderGaps } from "./analyzeGaps.js";
import { generateProviderQuestions } from "../llm/providerQuestionPhrasing.js";
import type { ConversationState } from "../domain/conversation.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { ProviderGap } from "./types.js";

export type AnalyzeFn = (params: {
  candidate: ProviderCandidate;
  state: ConversationState;
}) => ProviderGap[];

export type PhraseFn = (params: {
  candidate: ProviderCandidate;
  gaps: ProviderGap[];
  state: ConversationState;
}) => Promise<string[]>;

export interface PrepareProviderQuestionsParams {
  candidate: ProviderCandidate;
  state: ConversationState;
  /** Injected gap-analysis call; defaults to Task 33's real analyzeProviderGaps. */
  analyze?: AnalyzeFn;
  /** Injected phrasing call; defaults to Task 34's real generateProviderQuestions. */
  phrase?: PhraseFn;
}

export async function prepareProviderQuestions({
  candidate,
  state,
  analyze = analyzeProviderGaps,
  phrase = generateProviderQuestions,
}: PrepareProviderQuestionsParams): Promise<string[]> {
  const gaps = analyze({ candidate, state });
  return phrase({ candidate, gaps, state });
}
