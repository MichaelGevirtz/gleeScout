import { StyleSheet, Text, View } from "react-native";
import type { OtherProviderFact } from "../domain/types";

const MAX_VALUE_LENGTH = 100;

// Card-width display concern only — slices existing text, never rewrites
// or summarizes it. The backend's otherFacts values (and Provider
// Details, which renders the same FACTs untruncated) are unaffected.
function truncate(value: string): string {
  if (value.length <= MAX_VALUE_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_VALUE_LENGTH).trimEnd()}…`;
}

// Purely presentational — renders exactly what the backend already
// computed (backend/src/ranking/otherProviderFacts.ts). No selection or
// dedup logic here: the frontend never decides which FACTs are
// additional/non-duplicative, it only displays the structured result,
// truncating long values for card width.
export interface OtherProviderFactsProps {
  facts: OtherProviderFact[];
}

export function OtherProviderFacts({ facts }: OtherProviderFactsProps) {
  if (facts.length === 0) {
    return null;
  }

  return (
    <View testID="other-provider-facts" style={styles.container}>
      {facts.map((fact) => (
        <Text key={fact.kind} testID={`other-provider-fact-${fact.kind}`} style={styles.row}>
          {truncate(fact.value)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 2,
  },
  row: {
    fontSize: 13,
    color: "#374151",
  },
});
