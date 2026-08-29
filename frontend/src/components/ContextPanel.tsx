import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ConversationState } from "../domain/types";

export interface ContextPanelProps {
  state: ConversationState;
  matchCount: number;
  currentlyViewing?: string;
  isChatOpen: boolean;
  onOpenChat: () => void;
  onBackToMatches: () => void;
}

interface EventField {
  key: string;
  label: string;
  value: string;
}

// Same inclusion rule as ChatScreen's "what I know so far" chips
// (serviceCategory, dateTime, location, then categoryAttributes in
// object-iteration order) — see design/m14-ux-spec.md's Desktop
// addendum "Left pane" section. Core fields get fixed, human-readable
// labels; category attributes have no such fixed set (they're
// LLM-proposed per category), so the attribute name itself is the
// only label available without hardcoding per-category copy.
function computeEventFields(state: ConversationState): EventField[] {
  const fields: EventField[] = [];

  if (state.serviceCategory != null) {
    fields.push({ key: "serviceCategory", label: "Service", value: state.serviceCategory });
  }
  if (state.coreAttributes.dateTime != null) {
    fields.push({ key: "dateTime", label: "Date/time", value: state.coreAttributes.dateTime });
  }
  if (state.coreAttributes.location != null) {
    fields.push({ key: "location", label: "Location", value: state.coreAttributes.location });
  }
  for (const [name, slot] of Object.entries(state.categoryAttributes)) {
    if (slot.value != null) {
      fields.push({ key: name, label: name, value: slot.value });
    }
  }

  return fields;
}

export default function ContextPanel({
  state,
  matchCount,
  currentlyViewing,
  isChatOpen,
  onOpenChat,
  onBackToMatches,
}: ContextPanelProps) {
  const eventFields = computeEventFields(state);

  return (
    <View testID="context-panel" style={styles.panel}>
      <Text testID="context-panel-brand" style={styles.brand}>
        GleeScout
      </Text>

      <View testID="context-event-list" style={styles.eventList}>
        {eventFields.map((field) => (
          <View key={field.key} testID={`context-row-${field.key}`} style={styles.row}>
            <Text testID={`context-row-${field.key}-label`} style={styles.rowLabel}>
              {field.label}
            </Text>
            <Text testID={`context-row-${field.key}-value`} style={styles.rowValue}>
              {field.value}
            </Text>
          </View>
        ))}
      </View>

      <Text testID="context-match-count" style={styles.matchCount}>
        {matchCount} providers
      </Text>

      {currentlyViewing !== undefined && (
        <View testID="context-currently-viewing" style={styles.currentlyViewing}>
          <Text>
            <Text style={styles.currentlyViewingLabel}>Currently viewing: </Text>
            <Text style={styles.currentlyViewingValue}>{currentlyViewing}</Text>
          </Text>
        </View>
      )}

      <Pressable
        testID="context-panel-button"
        onPress={isChatOpen ? onBackToMatches : onOpenChat}
        style={styles.button}
      >
        <Text style={styles.buttonLabel}>{isChatOpen ? "Back to matches" : "Back to chat"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: 280,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: "#fafafa",
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    gap: 20,
  },
  brand: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  eventList: {
    gap: 12,
  },
  row: {
    gap: 2,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#9ca3af",
  },
  rowValue: {
    fontSize: 14,
    color: "#111827",
  },
  matchCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  currentlyViewing: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    gap: 2,
  },
  currentlyViewingLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#4338ca",
  },
  currentlyViewingValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  button: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  buttonLabel: {
    color: "#4338ca",
    fontWeight: "700",
    fontSize: 14,
  },
});
