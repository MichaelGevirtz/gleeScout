import { prepareProviderQuestions } from "../providerQuestions/prepareProviderQuestions.js";
import { simulateProviderResponses } from "../providerQuestions/simulateProviderResponses.js";
import type { ConversationState } from "../domain/conversation.js";
import type { Simulated } from "../domain/evidence.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { TraceEvent } from "../domain/trace.js";

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

export interface SelectProviderResult {
  answers: { question: string; answer: Simulated<string> }[];
  trace: TraceEvent[];
}

function candidateLabel(candidate: ProviderCandidate): string {
  return candidate.fields.name?.value ?? new URL(candidate.url).hostname;
}

export async function selectProvider({
  candidate,
  state,
  prepareQuestions = prepareProviderQuestions,
  simulate = simulateProviderResponses,
}: SelectProviderParams): Promise<SelectProviderResult> {
  const questions = await prepareQuestions({ candidate, state });
  const generatedAt = new Date().toISOString();
  const answers = await simulate({ candidate, questions, state, generatedAt });

  const timestamp = new Date().toISOString();
  const trace: TraceEvent[] = [
    {
      step: "prepareQuestions",
      summary: `Identified ${questions.length} question${questions.length === 1 ? "" : "s"} still needed for ${candidateLabel(candidate)}`,
      detail: { questions },
      timestamp,
    },
    {
      step: "simulateAnswers",
      summary: `Generated ${answers.length} simulated answer${answers.length === 1 ? "" : "s"} (not a real provider response)`,
      detail: { answerCount: answers.length },
      timestamp,
    },
  ];

  return { answers, trace };
}
