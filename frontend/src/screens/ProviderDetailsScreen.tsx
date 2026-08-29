import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ProviderCandidate, ProviderCandidateFields, RankingDimension } from "../domain/types";
import { hostnameFromUrl } from "../shared/hostname";
import SelectedProviderHeader from "../components/SelectedProviderHeader";

export interface ProviderDetailsScreenProps {
  candidate: ProviderCandidate;
  dimensionScores: Record<RankingDimension, number | null>;
  explanation: string;
  onSelectProvider: (candidate: ProviderCandidate) => void;
}

// Static copy — per design/m14-ux-spec.md screen 4, this caption is shown
// once, always, regardless of `inferred` content (never conditional).
const INFERRED_CAPTION = "Inferred from review patterns — not confirmed by the provider.";

// Friendly labels for Inferred<T>.sourceType. "provider_website" -> "provider
// website review" is spec-mandated; the others follow the same pattern.
const SOURCE_TYPE_LABELS: Record<string, string> = {
  google: "Google review",
  yelp: "Yelp review",
  provider_website: "provider website review",
  directory: "directory listing",
  other: "other source",
};

// Fixed order, per design/m14-ux-spec.md screen 4 — never derived from
// object key order.
const DIMENSION_ORDER: RankingDimension[] = [
  "requirementMatch",
  "geoFit",
  "priceFit",
  "reputation",
  "evidenceQuality",
];

const DIMENSION_LABELS: Record<RankingDimension, string> = {
  requirementMatch: "Requirement match",
  geoFit: "Geographic fit",
  priceFit: "Price fit",
  reputation: "Reputation",
  evidenceQuality: "Evidence quality",
};

// Fixed, deterministic iteration order for the "Sourced facts" section
// (the spec doesn't mandate a specific order here, only that every non-null
// field gets a row — this keeps rendering order stable/testable rather than
// depending on object-key insertion order).
const FIELD_ORDER: (keyof ProviderCandidateFields)[] = [
  "name",
  "location",
  "servicesOffered",
  "pricing",
  "availability",
  "rating",
  "reviewCount",
  "photos",
  "policies",
  "contactMethod",
];

function formatFactValue(value: string | number | string[]): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

export default function ProviderDetailsScreen({
  candidate,
  dimensionScores,
  explanation,
  onSelectProvider,
}: ProviderDetailsScreenProps) {
  const providerName = candidate.fields.name?.value ?? hostnameFromUrl(candidate.url);
  const inferredList = candidate.inferred ?? [];

  return (
    <ScrollView testID="provider-details-screen">
      <SelectedProviderHeader providerName={providerName} />

      {explanation ? <Text testID="explanation">{explanation}</Text> : null}

      <View testID="fact-section">
        <Text>Sourced facts</Text>
        <View testID="fact-list">
          {FIELD_ORDER.map((fieldName) => {
            const fact = candidate.fields[fieldName];
            if (!fact) {
              return null;
            }
            return (
              <View key={fieldName} testID={`fact-row-${fieldName}`}>
                <Text testID={`fact-row-${fieldName}-value`}>{formatFactValue(fact.value)}</Text>
                <Text testID={`fact-row-${fieldName}-source`}>{fact.source}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View testID="inferred-section">
        <Text>Inferred from reviews</Text>
        <Text testID="inferred-caption">{INFERRED_CAPTION}</Text>
        <View testID="inferred-list">
          {inferredList.map((item, index) => (
            <View key={index} testID={`inferred-card-${index}`}>
              <Text testID={`inferred-card-${index}-value`}>{item.value}</Text>
              {item.evidenceExcerpt ? (
                <Text testID={`inferred-card-${index}-excerpt`}>&ldquo;{item.evidenceExcerpt}&rdquo;</Text>
              ) : null}
              <Text testID={`inferred-card-${index}-source-type`}>
                {SOURCE_TYPE_LABELS[item.sourceType] ?? item.sourceType}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View testID="dimension-bars">
        {DIMENSION_ORDER.map((dimension) => {
          const score = dimensionScores[dimension];
          return (
            <View key={dimension} testID={`dimension-bar-${dimension}`}>
              <Text>{DIMENSION_LABELS[dimension]}</Text>
              {score === null ? (
                <View testID={`dimension-bar-${dimension}-empty`} style={styles.dashedBar}>
                  <Text>Not enough data</Text>
                </View>
              ) : (
                <View style={styles.barTrack}>
                  <View
                    testID={`dimension-bar-${dimension}-fill`}
                    style={[styles.barFill, { width: `${Math.round(score * 100)}%` }]}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>

      <Pressable testID="select-cta" onPress={() => onSelectProvider(candidate)}>
        <Text>Select {providerName}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dashedBar: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#999999",
    borderRadius: 4,
    padding: 8,
  },
  barTrack: {
    height: 8,
    backgroundColor: "#eeeeee",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    backgroundColor: "#4a90d9",
  },
});
