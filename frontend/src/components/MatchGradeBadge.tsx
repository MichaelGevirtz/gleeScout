import { StyleSheet, Text, View } from "react-native";
import type { MatchGrade } from "../domain/types";

// Pure label/color lookup keyed by the backend-computed MatchGrade.
// No thresholds, no math — the backend (backend/src/ranking/fitScore.ts)
// owns every numeric decision behind this grade. Label only — no
// subtitle: the card's confirmed-requirements checklist and
// explanation already say why, so a fixed generic sentence here
// would only restate the label.
const GRADE_LABELS: Record<MatchGrade, string> = {
  wonderful: "Wonderful match",
  good: "Good match",
  average: "Average match",
  poor: "Poor match",
  insufficient_data: "Not enough information to assess fit",
};

const GRADE_COLORS: Record<MatchGrade, { background: string; text: string }> = {
  wonderful: { background: "#ecfdf5", text: "#047857" },
  good: { background: "#f0fdf4", text: "#15803d" },
  average: { background: "#fffbeb", text: "#b45309" },
  poor: { background: "#fef2f2", text: "#b91c1c" },
  insufficient_data: { background: "#f3f4f6", text: "#6b7280" },
};

export interface MatchGradeBadgeProps {
  grade: MatchGrade;
}

export function MatchGradeBadge({ grade }: MatchGradeBadgeProps) {
  const colors = GRADE_COLORS[grade];

  return (
    <View testID="match-grade-badge" style={[styles.container, { backgroundColor: colors.background }]}>
      <Text testID="match-grade-label" style={[styles.label, { color: colors.text }]}>
        {GRADE_LABELS[grade]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
    gap: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
});
