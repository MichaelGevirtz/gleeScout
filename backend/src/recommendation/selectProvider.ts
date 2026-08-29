import { prepareProviderQuestions } from "../providerQuestions/prepareProviderQuestions.js";
import { simulateProviderResponses } from "../providerQuestions/simulateProviderResponses.js";
import type { ConversationState } from "../domain/conversation.js";
import type { Simulated } from "../domain/evidence.js";
import type { ProviderCandidate } from "../domain/provider.js";

export type PrepareQuestionsFn = (params: {
  candidate: ProviderCandidate;
  state: ConversationState;
}) => Promise<string[]>;

export type SimulateFn = (params: {
  candidate: ProviderCandidate;
  questions: string[];
  state: ConversationState;
  generatedAt: string;
}) => Promise<{ question: string; answer: Simulated<string> }[]>;

export interface SelectProviderParams {
  candidate: ProviderCandidate;
  state: ConversationState;
  /** Injected M10 call; defaults to Task 35's real prepareProviderQuestions. */
  prepareQuestions?: PrepareQuestionsFn;
  /** Injected M11 call; defaults to Task 40's real simulateProviderResponses. */
  simulate?: SimulateFn;
}

export async function selectProvider({
  candidate,
  state,
  prepareQuestions = prepareProviderQuestions,
  simulate = simulateProviderResponses,
}: SelectProviderParams): Promise<{ question: string; answer: Simulated<string> }[]> {
  const questions = await prepareQuestions({ candidate, state });
  const generatedAt = new Date().toISOString();
  return simulate({ candidate, questions, state, generatedAt });
}
