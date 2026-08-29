import { z } from "zod";
import { generateStructuredJson, type GeminiClient } from "./geminiClient.js";
import type { ConversationState } from "../domain/conversation.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { ProviderGap } from "../providerQuestions/types.js";

export const ProviderQuestionsResultSchema = z.object({
  questions: z.array(z.string()),
});
export type ProviderQuestionsResult = z.infer<typeof ProviderQuestionsResultSchema>;

const SYSTEM_INSTRUCTION = `You are the provider-question-phrasing step of an event-planning assistant.
A separate, deterministic part of the system has already decided exactly which gaps in knowledge about this provider need to be asked about — that list is final and not yours to change. Your only job is to phrase each gap as a single natural, specific question.

Rules:
- Return exactly one question per gap given, in the same order.
- Do not add, remove, merge, or reorder gaps, even if some seem redundant or unimportant.
- Use the known provider/request context only to make the phrasing feel natural and specific (e.g. referencing the provider's own known pricing, or the event's date), never to change what is being asked.
- Respond with JSON matching this shape: { "questions": string[] }`;

function describeGap(gap: ProviderGap): string {
  return `[${gap.topic}] ${gap.description}`;
}

function formatContext(candidate: ProviderCandidate, state: ConversationState): string {
  const lines: string[] = [];
  lines.push(`Provider name: ${candidate.fields.name?.value ?? "not known"}`);
  lines.push(`Provider known pricing: ${candidate.fields.pricing?.value ?? "not known"}`);
  lines.push(`Requested service category: ${state.serviceCategory ?? "not known"}`);
  lines.push(`Requested date/time: ${state.coreAttributes.dateTime ?? "not known"}`);
  lines.push(`Requested location: ${state.coreAttributes.location ?? "not known"}`);
  return lines.join("\n");
}

function buildPrompt(candidate: ProviderCandidate, gaps: ProviderGap[], state: ConversationState): string {
  return [
    "Gaps to phrase as questions (already decided, do not change):",
    gaps.map(describeGap).join("\n"),
    "",
    "Known context (for natural phrasing only, not for deciding what to ask):",
    formatContext(candidate, state),
  ].join("\n");
}

export type GenerateProviderQuestionsFn = (params: {
  schema: typeof ProviderQuestionsResultSchema;
  prompt: string;
  systemInstruction?: string;
  client?: GeminiClient;
}) => Promise<ProviderQuestionsResult>;

export interface GenerateProviderQuestionsParams {
  candidate: ProviderCandidate;
  gaps: ProviderGap[];
  state: ConversationState;
  /** Injected phrasing call; defaults to Task 05's real generateStructuredJson. */
  generate?: GenerateProviderQuestionsFn;
}

export async function generateProviderQuestions({
  candidate,
  gaps,
  state,
  generate = generateStructuredJson,
}: GenerateProviderQuestionsParams): Promise<string[]> {
  if (gaps.length === 0) {
    return [];
  }

  const result = await generate({
    schema: ProviderQuestionsResultSchema,
    prompt: buildPrompt(candidate, gaps, state),
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  if (result.questions.length !== gaps.length) {
    throw new Error(
      `Gemini returned ${result.questions.length} question(s) for ${gaps.length} gap(s).`,
    );
  }

  const questions = result.questions.map((q) => q.trim());
  if (questions.some((q) => q === "")) {
    throw new Error("Gemini returned a blank question.");
  }

  return questions;
}
