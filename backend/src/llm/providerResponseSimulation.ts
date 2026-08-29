import { z } from "zod";
import { generateStructuredJson, type GeminiClient } from "./geminiClient.js";
import type { ConversationState } from "../domain/conversation.js";
import type { ProviderCandidate } from "../domain/provider.js";

export const SimulatedAnswersResultSchema = z.object({
  answers: z.array(z.string()),
});
export type SimulatedAnswersResult = z.infer<typeof SimulatedAnswersResultSchema>;

const SYSTEM_INSTRUCTION = `You are the provider-response-simulation step of an event-planning assistant.
Instead of actually contacting the provider, you simulate the plausible answers a real provider in this business would give to the questions below, given what is already known about them and what the customer is requesting. This is a deliberate hypothetical simulation used to demonstrate the workflow — it is not a request to fabricate deceptive real-world claims about a specific business.

Rules:
- Return exactly one answer per question, in the same order.
- Do not add, remove, merge, or reorder questions.
- Answer as the provider plausibly would: concrete-sounding, specific values (e.g. a specific price, a specific time), consistent with the known context. Do not hedge, refuse, or say a real provider was not contacted.
- Respond with JSON matching this shape: { "answers": string[] }`;

function formatContext(candidate: ProviderCandidate, state: ConversationState): string {
  const lines: string[] = [];
  lines.push(`Provider name: ${candidate.fields.name?.value ?? "not known"}`);
  lines.push(`Provider known pricing: ${candidate.fields.pricing?.value ?? "not known"}`);
  lines.push(`Requested service category: ${state.serviceCategory ?? "not known"}`);
  lines.push(`Requested date/time: ${state.coreAttributes.dateTime ?? "not known"}`);
  lines.push(`Requested location: ${state.coreAttributes.location ?? "not known"}`);
  return lines.join("\n");
}

function buildPrompt(candidate: ProviderCandidate, questions: string[], state: ConversationState): string {
  return [
    "Questions to simulate plausible answers for (already decided, do not change):",
    questions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
    "",
    "Known context (ground the simulated answers in this):",
    formatContext(candidate, state),
  ].join("\n");
}

export type GenerateSimulatedAnswersFn = (params: {
  schema: typeof SimulatedAnswersResultSchema;
  prompt: string;
  systemInstruction?: string;
  client?: GeminiClient;
}) => Promise<SimulatedAnswersResult>;

export interface SimulateProviderAnswersParams {
  candidate: ProviderCandidate;
  questions: string[];
  state: ConversationState;
  /** Injected simulation call; defaults to Task 05's real generateStructuredJson. */
  generate?: GenerateSimulatedAnswersFn;
}

export async function simulateProviderAnswers({
  candidate,
  questions,
  state,
  generate = generateStructuredJson,
}: SimulateProviderAnswersParams): Promise<string[]> {
  if (questions.length === 0) {
    return [];
  }

  const result = await generate({
    schema: SimulatedAnswersResultSchema,
    prompt: buildPrompt(candidate, questions, state),
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  if (result.answers.length !== questions.length) {
    throw new Error(
      `Gemini returned ${result.answers.length} answer(s) for ${questions.length} question(s).`,
    );
  }

  const answers = result.answers.map((a) => a.trim());
  if (answers.some((a) => a === "")) {
    throw new Error("Gemini returned a blank answer.");
  }

  return answers;
}
