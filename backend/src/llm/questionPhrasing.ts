import { z } from "zod";
import { generateStructuredJson, type GeminiClient } from "./geminiClient.js";
import type { ConversationState } from "../domain/conversation.js";
import type { MissingAttributeTarget } from "../conversation/questionPolicy.js";

export const PendingQuestionSchema = z.object({
  question: z.string(),
});
export type PendingQuestionResult = z.infer<typeof PendingQuestionSchema>;

const SYSTEM_INSTRUCTION = `You are the question-phrasing step of an event-planning assistant.
A separate, deterministic part of the system has already decided exactly one piece of information to ask the user about next — that decision is final and not yours to make. Your only job is to phrase it as a single natural, friendly, conversational question.

Rules:
- Ask about exactly one thing: the given target. Do not ask about anything else, even if other information also seems missing.
- Do not combine it with another question (no "also, what's X and Y?").
- Do not restate or re-ask anything already listed as known.
- Do not question, second-guess, or comment on whether the target is the right thing to ask, whether it's still needed, or whether enough information has been gathered — treat it as already decided.
- Use the known state only to make the phrasing feel natural and contextual (e.g. referencing the service or location already mentioned), never to change what is being asked.
- Respond with JSON matching this shape: { "question": string }`;

function describeTarget(target: MissingAttributeTarget): string {
  if (target.kind === "core") {
    return target.field === "dateTime"
      ? "The event's date/time is not yet known."
      : "The event's location is not yet known.";
  }
  return `The category attribute "${target.name}" (${target.description}) is not yet known and is required for this service.`;
}

function formatKnownState(state: ConversationState): string {
  const lines: string[] = [];
  lines.push(`Known service category: ${state.serviceCategory ?? "not yet known"}`);
  lines.push(`Known date/time: ${state.coreAttributes.dateTime ?? "not yet known"}`);
  lines.push(`Known location: ${state.coreAttributes.location ?? "not yet known"}`);

  const attributeNames = Object.keys(state.categoryAttributes);
  if (attributeNames.length === 0) {
    lines.push("Known category attributes: none yet");
  } else {
    lines.push("Known category attributes:");
    for (const name of attributeNames) {
      const slot = state.categoryAttributes[name];
      lines.push(
        `  - ${name} (${slot.importance}): ${slot.description} — current value: ${
          slot.value ?? "not yet answered"
        }`
      );
    }
  }

  return lines.join("\n");
}

function buildPrompt(target: MissingAttributeTarget, state: ConversationState): string {
  return [
    "What to ask about (already decided, do not change):",
    describeTarget(target),
    "",
    "Known state (for natural phrasing only, not for deciding what to ask):",
    formatKnownState(state),
  ].join("\n");
}

export type GeneratePendingQuestionFn = (params: {
  schema: typeof PendingQuestionSchema;
  prompt: string;
  systemInstruction?: string;
  client?: GeminiClient;
}) => Promise<PendingQuestionResult>;

export interface GeneratePendingQuestionParams {
  target: MissingAttributeTarget;
  state: ConversationState;
  /** Injected phrasing call; defaults to Task 05's real generateStructuredJson. */
  generate?: GeneratePendingQuestionFn;
}

export async function generatePendingQuestion({
  target,
  state,
  generate = generateStructuredJson,
}: GeneratePendingQuestionParams): Promise<string> {
  const result = await generate({
    schema: PendingQuestionSchema,
    prompt: buildPrompt(target, state),
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const question = result.question.trim();
  if (question === "") {
    throw new Error("Gemini returned an empty question.");
  }

  return question;
}
