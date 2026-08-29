import { extractRequirements } from "../llm/extraction.js";
import type { ExtractionResult } from "../llm/extraction.js";
import { generatePendingQuestion } from "../llm/questionPhrasing.js";
import { mergeExtraction } from "./mergeExtraction.js";
import { isReadyForSearch, selectNextMissingAttribute } from "./questionPolicy.js";
import type { MissingAttributeTarget } from "./questionPolicy.js";
import type { ConversationState } from "../domain/conversation.js";

export type ExtractFn = (params: {
  message: string;
  state: ConversationState;
}) => Promise<ExtractionResult>;

export type PhraseFn = (params: {
  target: MissingAttributeTarget;
  state: ConversationState;
}) => Promise<string>;

export interface OrchestrateMessageParams {
  state: ConversationState;
  message: string;
  /** Injected extraction call; defaults to Task 06's real extractRequirements. */
  extract?: ExtractFn;
  /** Injected phrasing call; defaults to Task 11's real generatePendingQuestion. */
  phrase?: PhraseFn;
}

export async function orchestrateMessage({
  state,
  message,
  extract = extractRequirements,
  phrase = generatePendingQuestion,
}: OrchestrateMessageParams): Promise<ConversationState> {
  const extraction = await extract({ message, state });
  const merged = mergeExtraction({ state, extraction, userMessage: message });

  if (isReadyForSearch(merged)) {
    return { ...merged, phase: "ready_for_search" };
  }

  const target = selectNextMissingAttribute(merged);
  if (target === null) {
    throw new Error(
      "orchestrateMessage: isReadyForSearch was false but selectNextMissingAttribute returned null."
    );
  }

  const question = await phrase({ target, state: merged });

  return {
    ...merged,
    messages: [...merged.messages, { role: "assistant", content: question }],
  };
}
