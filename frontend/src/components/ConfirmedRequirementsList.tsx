import { StyleSheet, Text, View } from "react-native";
import type { ConfirmedRequirement } from "../domain/types";

// Purely presentational — renders exactly what the backend already
// computed (backend/src/ranking/confirmedRequirements.ts). No
// confirmation logic here: the frontend never decides which
// requirements are confirmed, it only displays the structured result.
export interface ConfirmedRequirementsListProps {
  requirements: ConfirmedRequirement[];
}

export function ConfirmedRequirementsList({ requirements }: ConfirmedRequirementsListProps) {
  if (requirements.length === 0) {
    return null;
  }

  return (
    <View testID="confirmed-requirements-list" style={styles.container}>
      {requirements.map((requirement, index) => (
        <Text
          key={`${requirement.kind}-${index}`}
          testID={`confirmed-requirement-${index}`}
          style={styles.row}
        >
          ✓ {requirement.label}
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
    fontWeight: "600",
    color: "#15803d",
  },
});
