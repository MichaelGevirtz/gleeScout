import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { ConversationState } from "../domain/types";

// Scout, the assistant's visual presence. Shown beside the latest
// assistant message only — see D21 / m14-ux-spec.md screen 1.
const scoutImage = require("../../assets/scout.png");

export interface ChatScreenProps {
  state: ConversationState;
  onSend: (message: string) => Promise<ConversationState>;
}

interface KnownField {
  key: string;
  value: string;
}

interface PendingBubble {
  text: string;
  status: "pending" | "failed";
  failureMessage?: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to send.";
}

// "What I know so far" chips: one per non-null/non-undefined field,
// in a fixed order (serviceCategory, dateTime, location, then
// categoryAttributes in object-iteration order) — see
// design/m14-ux-spec.md screen 1.
function computeKnownFields(state: ConversationState): KnownField[] {
  const fields: KnownField[] = [];

  if (state.serviceCategory != null) {
    fields.push({ key: "serviceCategory", value: state.serviceCategory });
  }
  if (state.coreAttributes.dateTime != null) {
    fields.push({ key: "dateTime", value: state.coreAttributes.dateTime });
  }
  if (state.coreAttributes.location != null) {
    fields.push({ key: "location", value: state.coreAttributes.location });
  }
  for (const [name, slot] of Object.entries(state.categoryAttributes)) {
    if (slot.value != null) {
      fields.push({ key: name, value: slot.value });
    }
  }

  return fields;
}

function findLastAssistantIndex(state: ConversationState): number {
  for (let i = state.messages.length - 1; i >= 0; i -= 1) {
    if (state.messages[i].role === "assistant") {
      return i;
    }
  }
  return -1;
}

export function ChatScreen({ state, onSend }: ChatScreenProps) {
  const [inputText, setInputText] = useState("");
  const [pendingBubble, setPendingBubble] = useState<PendingBubble | null>(null);

  const knownFields = useMemo(() => computeKnownFields(state), [state]);
  const lastAssistantIndex = useMemo(() => findLastAssistantIndex(state), [state]);

  // Recap chips: fields that are newly known compared to the
  // previously-rendered `state` — a client-side rendering choice, not
  // literal message content from the backend (m14-ux-spec.md screen 1).
  // `previousKnownKeysRef` holds the field-key set as of the *last
  // committed* render; it is read here (during the current render,
  // before the effect below updates it) and only written after commit,
  // which is what makes this a "previous state" comparison rather than
  // a same-render one.
  const previousKnownKeysRef = useRef<Set<string>>(new Set());
  const recapFields = useMemo(() => {
    const previousKeys = previousKnownKeysRef.current;
    return knownFields.filter((field) => !previousKeys.has(field.key));
  }, [knownFields]);
  useEffect(() => {
    previousKnownKeysRef.current = new Set(knownFields.map((field) => field.key));
  }, [knownFields]);

  const attemptSend = useCallback(
    async (text: string) => {
      setPendingBubble({ text, status: "pending" });
      try {
        await onSend(text);
        setPendingBubble(null);
      } catch (error) {
        setPendingBubble({ text, status: "failed", failureMessage: errorMessage(error) });
      }
    },
    [onSend],
  );

  const handleSend = useCallback(() => {
    const text = inputText;
    if (text.trim().length === 0) {
      return;
    }
    setInputText("");
    void attemptSend(text);
  }, [inputText, attemptSend]);

  const isSendDisabled = inputText.trim().length === 0;

  const handleRetry = useCallback(() => {
    if (!pendingBubble) {
      return;
    }
    void attemptSend(pendingBubble.text);
  }, [pendingBubble, attemptSend]);

  return (
    <View style={styles.container}>
      <ScrollView testID="chat-transcript" style={styles.transcript}>
        {state.messages.map((message, index) => {
          const isLatestAssistant = index === lastAssistantIndex;
          const recapChips =
            isLatestAssistant && recapFields.length > 0 ? (
              <View testID="chat-recap-chips" style={styles.chipRow}>
                {recapFields.map((field) => (
                  <View key={field.key} testID={`recap-chip-${field.key}`} style={styles.miniChip}>
                    <Text style={styles.miniChipText}>{field.value}</Text>
                  </View>
                ))}
              </View>
            ) : null;

          // The newest assistant turn is the one the user is actually
          // answering, so it gets Scout + heavier type. Earlier turns
          // keep the plain bubble treatment so the decoration doesn't
          // repeat down a growing transcript (task-48 precedent).
          if (isLatestAssistant) {
            return (
              <View key={index} testID={`chat-message-${index}`} style={styles.latestAssistantRow}>
                <Image
                  testID="chat-scout"
                  source={scoutImage}
                  style={styles.scout}
                  resizeMode="contain"
                  accessibilityLabel="Scout, your event planning assistant"
                />
                <View style={styles.latestAssistantBubble}>
                  <Text style={styles.latestAssistantText}>{message.content}</Text>
                  {recapChips}
                </View>
              </View>
            );
          }

          return (
            <View
              key={index}
              testID={`chat-message-${index}`}
              style={message.role === "user" ? styles.bubbleUser : styles.bubbleAssistant}
            >
              <Text style={message.role === "user" ? styles.bubbleUserText : styles.bubbleAssistantText}>
                {message.content}
              </Text>
              {recapChips}
            </View>
          );
        })}

        {pendingBubble && (
          <View testID="chat-pending-message" style={styles.bubbleUser}>
            <Text style={styles.bubbleUserText}>{pendingBubble.text}</Text>
            {pendingBubble.status === "pending" && (
              <Text style={styles.pendingLabel}>Sending…</Text>
            )}
            {pendingBubble.status === "failed" && (
              <View style={styles.failedRow}>
                <Text testID="chat-failed-message" style={styles.failedLabel}>
                  {pendingBubble.failureMessage ?? "Failed to send."}
                </Text>
                <Pressable testID="chat-retry" onPress={handleRetry}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {knownFields.length > 0 && (
        <View testID="chat-chip-bar" style={styles.chipBar}>
          <Text style={styles.chipBarLabel}>What I know so far</Text>
          <View testID="chip-count" style={styles.chipCountBadge}>
            <Text style={styles.chipCountText}>{knownFields.length}</Text>
          </View>
          <View style={styles.chipRow}>
            {knownFields.map((field) => (
              <View key={field.key} testID={`chip-${field.key}`} style={styles.miniChip}>
                <Text style={styles.miniChipText}>{field.value}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          testID="chat-input"
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type your answer…"
          placeholderTextColor="#9AA1AA"
        />
        <Pressable
          testID="chat-send"
          onPress={handleSend}
          disabled={isSendDisabled}
          accessibilityLabel="Send"
          style={[styles.sendButton, isSendDisabled && styles.sendButtonDisabled]}
        >
          <Text style={styles.sendText}>➤</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  transcript: {
    flex: 1,
  },
  bubbleAssistant: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 11,
    marginVertical: 4,
    maxWidth: "82%",
  },
  bubbleAssistantText: {
    fontSize: 13.5,
  },
  // Latest assistant turn: Scout beside a wider, heavier-type bubble.
  latestAssistantRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 4,
    marginVertical: 8,
    paddingRight: 20,
  },
  scout: {
    // Source artwork is 325x290; this keeps its aspect ratio.
    width: 104,
    height: 93,
  },
  latestAssistantBubble: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#FFE0CB",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  latestAssistantText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "500",
    color: "#27313F",
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: "#E8622E",
    borderRadius: 18,
    padding: 11,
    marginVertical: 4,
    maxWidth: "82%",
  },
  bubbleUserText: {
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  pendingLabel: {
    fontSize: 11,
    color: "#FFEDE3",
    marginTop: 4,
  },
  failedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  failedLabel: {
    fontSize: 11,
    color: "#FFEDE3",
  },
  retryText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    textDecorationLine: "underline",
  },
  chipBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    padding: 10,
  },
  chipBarLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#8A7A76",
  },
  chipCountBadge: {
    backgroundColor: "#FFEDE3",
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  chipCountText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#C94F21",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  miniChip: {
    backgroundColor: "#FFEDE3",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  miniChipText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#C94F21",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
  },
  input: {
    flex: 1,
    height: 56,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#E8622E",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    fontSize: 17,
    color: "#27313F",
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E8622E",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#F3C3AF",
  },
  sendText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
