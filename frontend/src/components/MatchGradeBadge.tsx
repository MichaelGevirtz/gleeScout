import { StyleSheet, Text, View } from "react-native";
import type { MatchGrade } from "../domain/types";

// Pure label/copy/color lookup keyed by the backend-computed MatchGrade.
// No thresholds, no math — the backend (backend/src/ranking/fitScore.ts)
// owns every numeric decision behind this grade.
const GRADE_COPY: Record<MatchGrade, { label: string; explanation: string }> = {
  wonderful: { label: "Wonderful match", explanation: "Meets your stated requirements very well" },
  good: { label: "Good match", explanation: "Meets most of your stated requirements" },
  average: { label: "Average match", explanation: "Partially meets your stated requirements" },
  poor: { label: "Poor match", explanation: "Meets few of your stated requirements" },
  insufficient_data: {
    label: "Not enough information to assess fit",
    explanation: "We don't have enough data yet to judge how well this fits what you asked for",
  },
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
  const copy = GRADE_COPY[grade];
  const colors = GRADE_COLORS[grade];

  return (
    <View testID="match-grade-badge" style={[styles.container, { backgroundColor: colors.background }]}>
      <Text testID="match-grade-label" style={[styles.label, { color: colors.text }]}>
        {copy.label}
      </Text>
      <Text testID="match-grade-explanation" style={[styles.explanation, { color: colors.text }]}>
        {copy.explanation}
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
  explanation: {
    fontSize: 12,
    fontWeight: "500",
  },
});
