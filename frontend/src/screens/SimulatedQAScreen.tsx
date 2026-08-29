import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { SimulatedAnswer } from "../domain/types";

/**
 * States 5-6 (design/m14-ux-spec.md "5 & 6. M10/M11 loading +
 * simulated answers"). The backend runs M10 (prepareProviderQuestions)
 * and M11 (simulateProviderResponses) inside one call —
 * `POST /conversation/:id/providers/select` — and returns both
 * together; there is no real intermediate state between them. The
 * "preparing questions… / preparing simulated answers…" two-step
 * sequence rendered by `phase: "loading"` is a purely cosmetic,
 * client-side pacing animation over that single in-flight request
 * (same discipline as TransitionScreen: internal timer, cleared on
 * unmount, no polling). This component never fetches — the parent
 * owns the request and switches `phase` once it settles.
 *
 * `phase: "results"` renders the SIMULATED answers. This is the only
 * screen in the app that ever shows SIMULATED data (per D14), so the
 * badge/banner copy below is frozen, non-negotiable spec text — see
 * the "Rendering rules (non-negotiable)" list in the UX spec. The
 * phrasing-as-estimate work already happened server-side (D15); this
 * component renders `question` / `answer.value` verbatim and must not
 * rephrase/reword them to sound more (or less) confirmed.
 */

const LOADING_STEPS = [
  { key: "questions", testID: "qa-loading-step-questions", label: "Preparing questions…" },
  { key: "answers", testID: "qa-loading-step-answers", label: "Preparing simulated answers…" },
] as const;

const STEP_INTERVAL_MS = 1200;

export const SIMULATED_BADGE_TEXT = "SIMULATED · NOT CONFIRMED";

const BANNER_PREFIX =
  "SIMULATED — NOT CONFIRMED WITH THE PROVIDER. We have not actually contacted ";
const BANNER_SUFFIX =
  ". Every answer below is an AI estimate; confirm directly with them before booking or paying anything.";

export function simulatedBannerText(providerName: string): string {
  return `${BANNER_PREFIX}${providerName}${BANNER_SUFFIX}`;
}

export type SimulatedQAScreenProps =
  | { phase: "loading" }
  | { phase: "results"; providerName: string; answers: SimulatedAnswer[]; onBack: () => void };

export function SimulatedQAScreen(props: SimulatedQAScreenProps) {
  if (props.phase === "loading") {
    return <LoadingPhase />;
  }

  return (
    <ResultsPhase
      providerName={props.providerName}
      answers={props.answers}
      onBack={props.onBack}
    />
  );
}

function LoadingPhase() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setActiveIndex((previous) => (previous + 1) % LOADING_STEPS.length);
    }, STEP_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <View testID="qa-loading" style={styles.loadingContainer}>
      {LOADING_STEPS.map((step, index) => {
        const isActive = index === activeIndex;
        return (
          <Text
            key={step.key}
            testID={step.testID}
            accessibilityState={{ selected: isActive }}
            style={[styles.loadingStep, isActive && styles.loadingStepActive]}
          >
            {step.label}
          </Text>
        );
      })}
    </View>
  );
}

interface ResultsPhaseProps {
  providerName: string;
  answers: SimulatedAnswer[];
  onBack: () => void;
}

function ResultsPhase({ providerName, answers, onBack }: ResultsPhaseProps) {
  return (
    <ScrollView testID="qa-results" style={styles.container}>
      <Text testID="qa-banner" style={styles.banner}>
        {simulatedBannerText(providerName)}
      </Text>

      {answers.map((entry, index) => (
        <View key={`${entry.question}-${index}`} testID={`qa-card-${index}`} style={styles.card}>
          <Text testID={`qa-badge-${index}`} style={styles.badge}>
            {SIMULATED_BADGE_TEXT}
          </Text>
          <Text testID={`qa-question-${index}`} style={styles.question}>
            {entry.question}
          </Text>
          <Text testID={`qa-answer-${index}`} style={styles.answer}>
            {entry.answer.value}
          </Text>
          {/* Decorative only — never presented as a contact timestamp. */}
          <Text testID={`qa-generated-${index}`} style={styles.generatedAt}>
            Generated just now
          </Text>
        </View>
      ))}

      <Pressable testID="qa-back" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonLabel}>Back to your matches</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingStep: {
    fontSize: 16,
    color: "#9ca3af",
  },
  loadingStepActive: {
    color: "#111827",
    fontWeight: "600",
  },
  container: {
    flex: 1,
  },
  banner: {
    padding: 12,
    backgroundColor: "#fef3c7",
    color: "#78350f",
    fontWeight: "600",
  },
  card: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  badge: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    color: "#92400e",
    backgroundColor: "#fde68a",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  question: {
    fontWeight: "700",
    marginBottom: 2,
  },
  answer: {
    marginBottom: 4,
  },
  generatedAt: {
    fontSize: 12,
    color: "#9ca3af",
  },
  backButton: {
    margin: 12,
    padding: 12,
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 6,
  },
  backButtonLabel: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
