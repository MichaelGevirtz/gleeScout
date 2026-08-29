import { z } from "zod";

export const ConversationPhaseSchema = z.enum(["gathering", "ready_for_search"]);
export type ConversationPhase = z.infer<typeof ConversationPhaseSchema>;

export const CoreAttributesSchema = z.object({
  dateTime: z.string().optional(),
  location: z.string().optional(),
});
export type CoreAttributes = z.infer<typeof CoreAttributesSchema>;

export const CategoryAttributeSlotSchema = z.object({
  description: z.string(),
  importance: z.enum(["required", "optional"]),
  value: z.string().nullable(),
});
export type CategoryAttributeSlot = z.infer<typeof CategoryAttributeSlotSchema>;

export const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

/**
 * Deterministic opening line seeded into every new session (task-76).
 * Static by design: seeding it costs no Gemini call, so the chat screen
 * is never blank on first open — even while the LLM is unavailable or
 * rate limited. It is an opener, not a question, so it never competes
 * with `selectNextMissingAttribute`'s pending question. Display-only
 * conversation history: nothing in the extraction / question-selection /
 * readiness path reads `messages`.
 */
export const SCOUT_WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hi, I'm Scout. Tell me about the event you're planning and I'll help you find the right providers.",
};

export const ConversationStateSchema = z.object({
  sessionId: z.string(),
  phase: ConversationPhaseSchema,
  serviceCategory: z.string().nullable(),
  coreAttributes: CoreAttributesSchema,
  categoryAttributes: z.record(z.string(), CategoryAttributeSlotSchema),
  messages: z.array(MessageSchema),
});
export type ConversationState = z.infer<typeof ConversationStateSchema>;

export function createInitialState(sessionId: string): ConversationState {
  return {
    sessionId,
    phase: "gathering",
    serviceCategory: null,
    coreAttributes: {},
    categoryAttributes: {},
    messages: [],
  };
}
