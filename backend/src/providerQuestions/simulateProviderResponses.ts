import { simulateProviderAnswers } from "../llm/providerResponseSimulation.js";
import { assembleSimulatedAnswers } from "./assembleSimulatedAnswers.js";
import type { ConversationState } from "../domain/conversation.js";
import type { Simulated } from "../domain/evidence.js";
import type { ProviderCandidate } from "../domain/provider.js";

export type SimulateFn = (params: {
  candidate: ProviderCandidate;
  questions: string[];
  state: ConversationState;
}) => Promise<string[]>;

export type AssembleFn = (params: {
  questions: string[];
  answers: string[];
  generatedAt: string;
}) => { question: string; answer: Simulated<string> }[];

export interface SimulateProviderResponsesParams {
  candidate: ProviderCandidate;
  questions: string[];
  state: ConversationState;
  generatedAt: string;
  /** Injected simulation call; defaults to Task 38's real simulateProviderAnswers. */
  simulate?: SimulateFn;
  /** Injected assembly call; defaults to Task 39's real assembleSimulatedAnswers. */
  assemble?: AssembleFn;
}

export async function simulateProviderResponses({
  candidate,
  questions,
  state,
  generatedAt,
  simulate = simulateProviderAnswers,
  assemble = assembleSimulatedAnswers,
}: SimulateProviderResponsesParams): Promise<{ question: string; answer: Simulated<string> }[]> {
  const answers = await simulate({ candidate, questions, state });
  return assemble({ questions, answers, generatedAt });
}
