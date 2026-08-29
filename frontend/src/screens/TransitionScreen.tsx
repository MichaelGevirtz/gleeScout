import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

/**
 * State 2 — the bridge screen shown for the duration of the single
 * `POST /conversation/:id/providers` call (see design/m14-ux-spec.md,
 * screen 2). Purely a cosmetic, indeterminate-wait animation: there is
 * no progress feed from the backend to poll, so this component has no
 * knowledge of the request itself and no props. The parent is solely
 * responsible for mounting it while the call is in flight and
 * unmounting it once the call settles.
 */

const STEPS = [
  { key: "searching", testID: "step-searching", label: "Searching the web" },
  { key: "reviews", testID: "step-reviews", label: "Checking reviews" },
  { key: "ranking", testID: "step-ranking", label: "Ranking matches" },
] as const;

const STEP_INTERVAL_MS = 1200;

export default function TransitionScreen() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setActiveIndex((previous) => (previous + 1) % STEPS.length);
    }, STEP_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <View style={styles.container}>
      {STEPS.map((step, index) => {
        const isActive = index === activeIndex;
        return (
          <Text
            key={step.key}
            testID={step.testID}
            accessibilityState={{ selected: isActive }}
            style={[styles.step, isActive && styles.stepActive]}
          >
            {step.label}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  step: {
    fontSize: 16,
    color: "#9ca3af",
  },
  stepActive: {
    color: "#111827",
    fontWeight: "600",
  },
});
