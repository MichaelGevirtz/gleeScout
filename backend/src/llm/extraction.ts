import { z } from "zod";
import { generateStructuredJson, type GeminiClient } from "./geminiClient.js";
import type { ConversationState } from "../domain/conversation.js";

export const ExtractionResultSchema = z.object({
  serviceCategory: z.string().nullable(),
  coreAttributes: z.object({
    dateTime: z.string().nullable(),
    location: z.string().nullable(),
  }),
  categoryAttributes: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      importance: z.enum(["required", "optional"]),
      value: z.string().nullable(),
    })
  ),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

const SYSTEM_INSTRUCTION = `You are the requirement-extraction step of an event-planning assistant.
Given the conversation's current known state and the user's latest message, respond with JSON matching this shape:
{
  "serviceCategory": string | null,
  "coreAttributes": { "dateTime": string | null, "location": string | null },
  "categoryAttributes": Array<{ "name": string, "description": string, "importance": "required" | "optional", "value": string | null }>
}

Rules:
- "serviceCategory": the type of service being requested (e.g. "bounce house rental", "wedding photographer"). Use null only if it is genuinely unclear from the whole conversation so far.
- "categoryAttributes" must list every attribute that matters for this service category, not just ones mentioned in this message. If the known state already lists category attributes, reuse the same "name" and "description" for those you keep, and add any new ones this message reveals are relevant.
- Every categoryAttribute must be something a provider's own website or listing would state as a fact about their service (e.g. capacity, delivery radius, setup included, water slide option). Never propose an attribute describing the customer's event context, purpose, occasion, or who the event is for (e.g. occasion, relationship to guest of honor) — a provider's listing cannot state facts about the customer's event.
- For every field's "value" (coreAttributes.dateTime, coreAttributes.location, and each categoryAttributes[].value): only set it if the CURRENT message states or changes that value. If the current message does not mention it, return null even if the known state already has a value for it — do not copy known-state values forward. A separate step reconciles this output with existing state.`;

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

function buildPrompt(message: string, state: ConversationState): string {
  return [
    "Current known state:",
    formatKnownState(state),
    "",
    "Latest user message:",
    message,
  ].join("\n");
}

export type GenerateExtractionFn = (params: {
  schema: typeof ExtractionResultSchema;
  prompt: string;
  systemInstruction?: string;
  client?: GeminiClient;
}) => Promise<ExtractionResult>;

export interface ExtractRequirementsParams {
  message: string;
  state: ConversationState;
  /** Injected extraction call; defaults to Task 05's real generateStructuredJson. */
  generate?: GenerateExtractionFn;
}

export async function extractRequirements({
  message,
  state,
  generate = generateStructuredJson,
}: ExtractRequirementsParams): Promise<ExtractionResult> {
  return generate({
    schema: ExtractionResultSchema,
    prompt: buildPrompt(message, state),
    systemInstruction: SYSTEM_INSTRUCTION,
  });
}
