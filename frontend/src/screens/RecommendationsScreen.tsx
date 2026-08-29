import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type {
  ProviderCandidate,
  ProviderCandidateFields,
  ProviderScore,
} from "../domain/types";
import { hostnameFromUrl } from "../shared/hostname";

const EM_DASH = "—";
const DIMENSION_COUNT = 5;

function countFactsSourced(fields: ProviderCandidateFields): number {
  return Object.values(fields).filter((value) => value != null).length;
}

function countSignals(dimensionScores: ProviderScore["dimensionScores"]): number {
  return Object.values(dimensionScores).filter((value) => value != null).length;
}

function deriveName(candidate: ProviderCandidate): string {
  return candidate.fields.name?.value ?? hostnameFromUrl(candidate.url);
}

function derivePrice(candidate: ProviderCandidate): string {
  return candidate.fields.pricing?.value ?? EM_DASH;
}

function deriveRating(candidate: ProviderCandidate): string {
  const rating = candidate.fields.rating?.value;
  if (rating == null) {
    return EM_DASH;
  }
  const reviewCount = candidate.fields.reviewCount?.value;
  return reviewCount != null ? `${rating} (${reviewCount} reviews)` : `${rating}`;
}

export interface RecommendationsScreenProps {
  providers: ProviderScore[];
  onSelectRow: (provider: ProviderScore) => void;
  onViewTrace: () => void;
}

function TraceLink({ onViewTrace }: { onViewTrace: () => void }) {
  return (
    <Pressable testID="view-trace-link" onPress={onViewTrace} style={styles.traceLink}>
      <Text style={styles.traceLinkText}>How was this recommendation produced?</Text>
    </Pressable>
  );
}

export function RecommendationsScreen({ providers, onSelectRow, onViewTrace }: RecommendationsScreenProps) {
  if (providers.length === 0) {
    return (
      <ScrollView testID="recommendations-screen" style={styles.container}>
        <View testID="recommendations-empty" style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No matching providers found. Try adjusting your requirements and searching again.
          </Text>
        </View>
        <TraceLink onViewTrace={onViewTrace} />
      </ScrollView>
    );
  }

  return (
    <ScrollView testID="recommendations-screen" style={styles.container}>
      <View testID="recommendations-header" style={styles.header}>
        <Text testID="recommendations-heading" style={styles.heading}>
          Your best matches
        </Text>
        <Text testID="recommendations-subtitle" style={styles.subtitle}>
          Based on your requirements
        </Text>
        <View style={styles.metaRow}>
          <Text testID="recommendations-count" style={styles.count}>
            {providers.length} providers
          </Text>
          {/* Decorative only — real client-side sort is deferred (Open Decision #4, m14-ux-spec.md). */}
          <View testID="sort-control" style={styles.sortPill}>
            <Text style={styles.sortLabel}>Sort: Best match</Text>
          </View>
        </View>
      </View>

      {providers.map((provider, index) => {
        const { candidate } = provider;
        const rank = index + 1;
        const factsSourced = countFactsSourced(candidate.fields);
        const inferredCount = candidate.inferred?.length ?? 0;
        const signals = countSignals(provider.dimensionScores);

        return (
          <Pressable
            key={`${candidate.url}-${index}`}
            testID={`provider-row-${index}`}
            onPress={() => onSelectRow(provider)}
            style={styles.row}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.rank}>{rank}</Text>
              <Text testID={`provider-row-${index}-name`} style={styles.name}>
                {deriveName(candidate)}
              </Text>
            </View>
            <Text testID={`provider-row-${index}-price`}>{derivePrice(candidate)}</Text>
            <Text testID={`provider-row-${index}-rating`}>{deriveRating(candidate)}</Text>
            <Text testID={`provider-row-${index}-facts`}>{factsSourced} facts sourced</Text>
            <Text testID={`provider-row-${index}-inferred`}>{inferredCount} inferred</Text>
            <Text testID={`provider-row-${index}-signals`}>
              Signals: {signals} / {DIMENSION_COUNT}
            </Text>
            <Text testID={`provider-row-${index}-rationale`}>{provider.explanation}</Text>
          </Pressable>
        );
      })}

      <TraceLink onViewTrace={onViewTrace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 12,
    gap: 2,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 13,
    color: "#6b7280",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  count: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  sortPill: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
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
  row: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  rank: {
    fontWeight: "700",
    marginRight: 8,
  },
  name: {
    fontWeight: "700",
    fontSize: 16,
  },
  traceLink: {
    padding: 12,
  },
  traceLinkText: {
    color: "#4b5563",
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
