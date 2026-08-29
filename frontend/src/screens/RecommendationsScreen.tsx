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
}

export function RecommendationsScreen({ providers, onSelectRow }: RecommendationsScreenProps) {
  return (
    <ScrollView testID="recommendations-screen" style={styles.container}>
      {/* Decorative only — real client-side sort is deferred (Open Decision #4, m14-ux-spec.md). */}
      <View testID="sort-control" style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort: Best match</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sortRow: {
    padding: 12,
  },
  sortLabel: {
    fontWeight: "600",
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
});
