import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { TraceEvent } from "../domain/types";

const EM_DASH = "—";

const STEP_TITLES: Record<string, string> = {
  discover: "Provider discovery",
  enrich: "Enrichment",
  rank: "Ranking",
  recommend: "Recommendation",
  prepareQuestions: "Provider selection — questions identified",
  simulateAnswers: "Simulated answers",
};

function titleFor(step: string): string {
  return STEP_TITLES[step] ?? step;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}: </Text>
      {value}
    </Text>
  );
}

const MATCH_GRADE_LABELS: Record<string, string> = {
  wonderful: "Wonderful match",
  good: "Good match",
  average: "Average match",
  poor: "Poor match",
  insufficient_data: "Not enough information to assess fit",
};

interface RankScore {
  provider: string;
  score: number;
  dimensionScores: Record<string, number | null>;
  fitScore: number | null;
  matchGrade: string;
  explanation: string;
}

interface ExcludedCandidate {
  provider: string;
  reason: string;
  unmatched: { label: string; kind: string }[];
}

function EventDetail({ event }: { event: TraceEvent }) {
  const detail = event.detail;
  if (!detail) {
    return null;
  }

  switch (event.step) {
    case "discover":
      return (
        <>
          <DetailLine label="Search query" value={String(detail.query)} />
          <DetailLine label="Candidates found" value={String(detail.candidatesFound)} />
        </>
      );
    case "enrich":
      return (
        <>
          <DetailLine label="Enriched with review signal" value={String(detail.enrichedWithSignal)} />
          <DetailLine label="Enriched, no signal found" value={String(detail.enrichedNoSignalFound)} />
          <DetailLine label="Not enriched" value={String(detail.notEnriched)} />
        </>
      );
    case "rank": {
      const scores = (detail.scores as RankScore[] | undefined) ?? [];
      const excluded = (detail.excluded as ExcludedCandidate[] | undefined) ?? [];
      return (
        <>
          {scores.map((s, i) => (
            <View key={`${s.provider}-${i}`} style={styles.scoreBlock} testID={`trace-score-${i}`}>
              <Text style={styles.scoreProvider}>
                {s.provider} — score {s.score.toFixed(2)}
              </Text>
              <Text testID={`trace-score-${i}-grade`} style={styles.gradeLine}>
                {MATCH_GRADE_LABELS[s.matchGrade] ?? s.matchGrade} (fitScore:{" "}
                {s.fitScore === null ? EM_DASH : s.fitScore.toFixed(2)})
              </Text>
              <Text testID={`trace-score-${i}-explanation`} style={styles.dimensionLine}>
                {s.explanation}
              </Text>
              {Object.entries(s.dimensionScores).map(([dim, val]) => (
                <Text key={dim} style={styles.dimensionLine}>
                  {dim}: {val === null ? EM_DASH : val.toFixed(2)}
                </Text>
              ))}
            </View>
          ))}
          {excluded.length > 0 && (
            <View style={styles.excludedBlock} testID="trace-excluded">
              <Text style={styles.excludedTitle}>Excluded</Text>
              {excluded.map((e, i) => (
                <View key={`${e.provider}-${i}`}>
                  <Text testID={`trace-excluded-${i}`} style={styles.dimensionLine}>
                    {e.provider} {EM_DASH} {e.reason}
                  </Text>
                  {e.unmatched.length > 0 && (
                    <Text testID={`trace-excluded-${i}-unmatched`} style={styles.dimensionLine}>
                      Checked: {e.unmatched.map((r) => r.label).join(", ")}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </>
      );
    }
    case "recommend":
      return <DetailLine label="Providers selected" value={String(detail.count)} />;
    case "prepareQuestions": {
      const questions = (detail.questions as string[] | undefined) ?? [];
      if (questions.length === 0) {
        return <Text style={styles.detailLine}>No further questions needed.</Text>;
      }
      return (
        <>
          {questions.map((q, i) => (
            <Text key={i} style={styles.detailLine} testID={`trace-question-${i}`}>
              • {q}
            </Text>
          ))}
        </>
      );
    }
    case "simulateAnswers":
      return <DetailLine label="Simulated answers generated" value={String(detail.answerCount)} />;
    default:
      return null;
  }
}

export interface TraceScreenProps {
  events: TraceEvent[];
  onBack: () => void;
}

export function TraceScreen({ events, onBack }: TraceScreenProps) {
  return (
    <ScrollView testID="trace-screen" style={styles.container}>
      <View style={styles.banner} testID="trace-banner">
        <Text style={styles.bannerTitle}>Debug / Transparency View</Text>
        <Text style={styles.bannerText}>
          The steps behind this recommendation. Not part of the normal user flow.
        </Text>
      </View>

      <Pressable onPress={onBack} testID="trace-back-button" style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back to recommendations</Text>
      </Pressable>

      {events.length === 0 ? (
        <View style={styles.emptyState} testID="trace-empty">
          <Text style={styles.emptyStateText}>No trace recorded yet.</Text>
        </View>
      ) : (
        events.map((event, index) => (
          <View key={`${event.step}-${index}`} style={styles.section} testID={`trace-section-${index}`}>
            <Text style={styles.sectionTitle}>
              {index + 1}. {titleFor(event.step)}
            </Text>
            <Text style={styles.summary}>{event.summary}</Text>
            <EventDetail event={event} />
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  banner: {
    padding: 16,
    backgroundColor: "#fef3c7",
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a",
  },
  bannerTitle: {
    fontWeight: "700",
    fontSize: 14,
    color: "#92400e",
  },
  bannerText: {
    fontSize: 12,
    color: "#92400e",
    marginTop: 2,
  },
  backButton: {
    padding: 12,
  },
  backButtonText: {
    fontWeight: "600",
    color: "#111827",
  },
  emptyState: {
    padding: 24,
    alignItems: "center",
  },
  emptyStateText: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 14,
  },
  section: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 2,
  },
  summary: {
    color: "#374151",
    marginBottom: 6,
  },
  detailLine: {
    fontSize: 13,
    color: "#111827",
    marginBottom: 2,
  },
  detailLabel: {
    fontWeight: "600",
  },
  scoreBlock: {
    marginTop: 4,
    marginBottom: 4,
  },
  scoreProvider: {
    fontWeight: "600",
    fontSize: 13,
  },
  gradeLine: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginLeft: 8,
  },
  dimensionLine: {
    fontSize: 12,
    color: "#4b5563",
    marginLeft: 8,
  },
  excludedBlock: {
    marginTop: 8,
  },
  excludedTitle: {
    fontWeight: "600",
    fontSize: 13,
    color: "#374151",
  },
});
