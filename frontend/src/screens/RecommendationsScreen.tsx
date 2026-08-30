import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ProviderCandidate, ProviderScore } from "../domain/types";
import { hostnameFromUrl } from "../shared/hostname";
import { MatchGradeBadge } from "../components/MatchGradeBadge";
import { ConfirmedRequirementsList } from "../components/ConfirmedRequirementsList";
import { OtherProviderFacts } from "../components/OtherProviderFacts";
import { deriveReputationDisplay, formatReputationLine } from "../shared/reputationDisplay";

function deriveName(candidate: ProviderCandidate): string {
  return candidate.fields.name?.value ?? hostnameFromUrl(candidate.url);
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
        <Text testID="recommendations-count" style={styles.count}>
          {providers.length} providers
        </Text>
      </View>

      {providers.map((provider, index) => {
        const { candidate } = provider;
        const rank = index + 1;
        // A real, independently sourced rating always beats the fabricated
        // mock; the mock is only a fallback, and always says so.
        const reputation = deriveReputationDisplay(candidate);

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

            <MatchGradeBadge grade={provider.matchGrade} />

            <ConfirmedRequirementsList requirements={provider.confirmedRequirements} />

            <OtherProviderFacts facts={provider.otherFacts} />

            {reputation && (
              <Text testID={`provider-row-${index}-rating`} style={styles.reputation}>
                {formatReputationLine(reputation)}
              </Text>
            )}

            <Text style={styles.viewDetails}>View details</Text>
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
  count: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginTop: 8,
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
    gap: 6,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  rank: {
    fontWeight: "700",
    marginRight: 8,
  },
  name: {
    fontWeight: "700",
    fontSize: 16,
  },
  reputation: {
    fontSize: 13,
    color: "#374151",
  },
  viewDetails: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4338ca",
    alignSelf: "flex-end",
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
