import { Pressable, Text, View } from "react-native";
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
    <View testID="context-panel">
      <Text testID="context-panel-brand">GleeScout</Text>

      <View testID="context-event-list">
        {eventFields.map((field) => (
          <View key={field.key} testID={`context-row-${field.key}`}>
            <Text testID={`context-row-${field.key}-label`}>{field.label}</Text>
            <Text testID={`context-row-${field.key}-value`}>{field.value}</Text>
          </View>
        ))}
      </View>

      <Text testID="context-match-count">{matchCount} matches found</Text>

      {currentlyViewing !== undefined && (
        <View testID="context-currently-viewing">
          <Text>Currently viewing: {currentlyViewing}</Text>
        </View>
      )}

      <Pressable testID="context-panel-button" onPress={isChatOpen ? onBackToMatches : onOpenChat}>
        <Text>{isChatOpen ? "Back to matches" : "Chat"}</Text>
      </Pressable>
    </View>
  );
}
