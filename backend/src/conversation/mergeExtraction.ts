import type { CategoryAttributeSlot, ConversationState } from "../domain/conversation.js";
import type { ExtractionResult } from "../llm/extraction.js";

export interface MergeExtractionParams {
  state: ConversationState;
  extraction: ExtractionResult;
  userMessage: string;
}

export function mergeExtraction({
  state,
  extraction,
  userMessage,
}: MergeExtractionParams): ConversationState {
  const messages = [...state.messages, { role: "user" as const, content: userMessage }];

  const serviceCategory = state.serviceCategory ?? extraction.serviceCategory;

  const coreAttributes = {
    dateTime: extraction.coreAttributes.dateTime ?? state.coreAttributes.dateTime,
    location: extraction.coreAttributes.location ?? state.coreAttributes.location,
  };

  const categoryAttributes: Record<string, CategoryAttributeSlot> = { ...state.categoryAttributes };
  for (const attr of extraction.categoryAttributes) {
    const existing = state.categoryAttributes[attr.name];
    categoryAttributes[attr.name] = {
      description: attr.description,
      importance: attr.importance,
      value: attr.value ?? existing?.value ?? null,
    };
  }

  return {
    ...state,
    serviceCategory,
    coreAttributes,
    categoryAttributes,
    messages,
  };
}
