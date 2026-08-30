import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Polygon, Rect } from "react-native-svg";
import type { MatchGrade, ProviderCandidate, ProviderCandidateFields } from "../domain/types";
import { hostnameFromUrl } from "../shared/hostname";
import { deriveReputationDisplay } from "../shared/reputationDisplay";
import SelectedProviderHeader from "../components/SelectedProviderHeader";
import { MatchGradeBadge } from "../components/MatchGradeBadge";

export interface ProviderDetailsScreenProps {
  candidate: ProviderCandidate;
  matchGrade: MatchGrade;
  onSelectProvider: (candidate: ProviderCandidate) => void;
}

// Static copy — per design/m14-ux-spec.md screen 4, shown once whenever the
// section renders (i.e. whenever `inferred` is non-empty); the whole section
// is omitted when there's nothing to disclaim.
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

// Fixed, deterministic iteration order for the "Sourced facts" list.
// "name" is excluded — it's already shown in SelectedProviderHeader, so a
// separate row would just repeat it. "photos" is excluded — it renders as
// its own hero + filmstrip block above this list, not a text row.
type ListedField = Exclude<keyof ProviderCandidateFields, "name" | "photos">;
const FIELD_ORDER: ListedField[] = [
  "location",
  "servicesOffered",
  "pricing",
  "availability",
  "rating",
  "reviewCount",
  "policies",
  "contactMethod",
];

const FIELD_LABELS: Record<ListedField, string> = {
  location: "Location",
  servicesOffered: "Services offered",
  pricing: "Pricing",
  availability: "Availability",
  rating: "Rating",
  reviewCount: "Review count",
  policies: "Policies",
  contactMethod: "Contact",
};

const MAX_FILMSTRIP_IMAGES = 6;

function FieldIcon({ field }: { field: ListedField }) {
  const stroke = "#9ca3af";
  switch (field) {
    case "location":
      return (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z"
            stroke={stroke}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={10} r={2.4} stroke={stroke} strokeWidth={1.8} />
        </Svg>
      );
    case "servicesOffered":
    case "pricing":
      return (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path
            d="M20.59 13.41 12 22l-9-9 8.59-8.59A2 2 0 0 1 13 4h6a2 2 0 0 1 2 2v6a2 2 0 0 1-.41 1.41z"
            stroke={stroke}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={16.5} cy={7.5} r={1.1} fill={stroke} />
        </Svg>
      );
    case "availability":
      return (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Rect x={3} y={5} width={18} height={16} rx={2} stroke={stroke} strokeWidth={1.8} />
          <Line x1={16} y1={3} x2={16} y2={7} stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
          <Line x1={8} y1={3} x2={8} y2={7} stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
          <Line x1={3} y1={10} x2={21} y2={10} stroke={stroke} strokeWidth={1.8} />
        </Svg>
      );
    case "rating":
    case "reviewCount":
      return (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Polygon
            points="12 2.5 15 9.2 22 9.8 16.8 14.6 18.3 21.5 12 17.8 5.7 21.5 7.2 14.6 2 9.8 9 9.2"
            stroke={stroke}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "policies":
      return (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3l7 3v6c0 5-3.5 8.5-7 9-3.5-.5-7-4-7-9V6l7-3z"
            stroke={stroke}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M9 12l2 2 4-4" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "contactMethod":
      return (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Rect x={3} y={5} width={18} height={14} rx={2} stroke={stroke} strokeWidth={1.8} />
          <Path d="M3 7l9 6 9-6" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
  }
}

function SectionHeading({ icon, label }: { icon: "sourced" | "inferred"; label: string }) {
  return (
    <View style={styles.sectionHeading}>
      {icon === "sourced" ? (
        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6Z"
            stroke="#4338ca"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M9 12l2 2 4-4" stroke="#4338ca" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : (
        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
          <Circle cx={11} cy={11} r={7} stroke="#4338ca" strokeWidth={2.2} />
          <Line x1={21} y1={21} x2={16.5} y2={16.5} stroke="#4338ca" strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
      )}
      <Text style={styles.sectionHeadingText}>{label}</Text>
    </View>
  );
}

// A real, independently sourced rating FACT always wins here, shown with the
// site it came from. The fabricated blend
// (backend/src/recommendation/mockReputationSignals.ts) is only a fallback, and
// when it is shown it always carries the mandatory "(simulated)" label — the
// quieter disclosure line below it is an addition, never a substitute for that
// label (task-98 supersedes the task-84 treatment described in decisions.md D26).

function formatFactValue(value: string | number | string[]): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

function PhotoGallery({ urls }: { urls: string[] }) {
  const [hero, ...rest] = urls;
  const filmstrip = rest.slice(0, MAX_FILMSTRIP_IMAGES);
  const remaining = Math.max(0, urls.length - 1 - MAX_FILMSTRIP_IMAGES);

  return (
    <View testID="photo-gallery" style={styles.photoGallery}>
      <Image testID="photo-gallery-hero" source={{ uri: hero }} style={styles.photoHero} resizeMode="cover" />
      {filmstrip.length > 0 || remaining > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          testID="photo-gallery-filmstrip"
          style={styles.filmstrip}
        >
          {filmstrip.map((url, index) => (
            <Image
              key={url}
              testID={`photo-gallery-filmstrip-image-${index}`}
              source={{ uri: url }}
              style={styles.filmstripImage}
              resizeMode="cover"
            />
          ))}
          {remaining > 0 && (
            <View testID="photo-gallery-more" style={styles.filmstripMore}>
              <Text style={styles.filmstripMoreText}>+{remaining}</Text>
            </View>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

export default function ProviderDetailsScreen({
  candidate,
  matchGrade,
  onSelectProvider,
}: ProviderDetailsScreenProps) {
  const providerName = candidate.fields.name?.value ?? hostnameFromUrl(candidate.url);
  const inferredList = candidate.inferred ?? [];
  const photosFact = candidate.fields.photos;
  const reputation = deriveReputationDisplay(candidate);

  return (
    <View testID="provider-details-screen" style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <SelectedProviderHeader providerName={providerName} />

        <View style={styles.body}>
          <MatchGradeBadge grade={matchGrade} />

          {reputation ? (
            <View testID="reputation-line" style={styles.reputationBlock}>
              <Text testID="reputation-line-text" style={styles.reputationText}>
                {reputation.kind === "real" ? reputation.text : `${reputation.text} (simulated)`}
              </Text>
              <Text testID="reputation-line-disclosure" style={styles.reputationDisclosure}>
                {reputation.kind === "real"
                  ? `Sourced from ${reputation.sourceLabel}`
                  : "Mock data for demo · based on Google & Yelp"}
              </Text>
            </View>
          ) : null}

          {photosFact ? <PhotoGallery urls={photosFact.value} /> : null}

          <View testID="fact-section">
            <SectionHeading icon="sourced" label="Sourced facts" />
            <View testID="fact-list">
              {FIELD_ORDER.map((fieldName) => {
                const fact = candidate.fields[fieldName];
                if (!fact) {
                  return null;
                }
                return (
                  <View key={fieldName} testID={`fact-row-${fieldName}`} style={styles.factRow}>
                    <View style={styles.factRowLeft}>
                      <FieldIcon field={fieldName} />
                      <Text style={styles.factRowLabel}>{FIELD_LABELS[fieldName]}</Text>
                    </View>
                    <Text testID={`fact-row-${fieldName}-value`} style={styles.factRowValue}>
                      {formatFactValue(fact.value)}
                    </Text>
                    <Text testID={`fact-row-${fieldName}-source`} style={styles.factRowSource}>
                      {fact.source}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {inferredList.length > 0 ? (
            <View testID="inferred-section">
              <SectionHeading icon="inferred" label="Inferred from reviews" />
              <Text testID="inferred-caption" style={styles.inferredCaption}>
                {INFERRED_CAPTION}
              </Text>
              <View testID="inferred-list">
                {inferredList.map((item, index) => (
                  <View key={index} testID={`inferred-card-${index}`} style={styles.inferredCard}>
                    <Text testID={`inferred-card-${index}-value`} style={styles.inferredValue}>
                      {item.value}
                    </Text>
                    {item.evidenceExcerpt ? (
                      <Text testID={`inferred-card-${index}-excerpt`} style={styles.inferredExcerpt}>
                        &ldquo;{item.evidenceExcerpt}&rdquo;
                      </Text>
                    ) : null}
                    <Text testID={`inferred-card-${index}-source-type`} style={styles.inferredSourceType}>
                      {SOURCE_TYPE_LABELS[item.sourceType] ?? item.sourceType}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View testID="sticky-footer" style={styles.stickyFooter}>
        <Pressable testID="select-cta" onPress={() => onSelectProvider(candidate)} style={styles.ctaButton}>
          <Text style={styles.ctaButtonText}>Select {providerName}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    padding: 16,
    paddingBottom: 32,
  },
  reputationBlock: {
    marginTop: 10,
  },
  reputationText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  reputationDisclosure: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
  },
  stickyFooter: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    padding: 16,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 24,
    marginBottom: 4,
  },
  sectionHeadingText: {
    fontWeight: "700",
    fontSize: 14,
    color: "#111827",
  },
  photoGallery: {
    marginTop: 16,
  },
  photoHero: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  filmstrip: {
    marginTop: 8,
  },
  filmstripImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 6,
    backgroundColor: "#f3f4f6",
  },
  filmstripMore: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  filmstripMoreText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
  factRow: {
    gap: 4,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  factRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  factRowLabel: {
    fontSize: 13.5,
    color: "#6b7280",
  },
  factRowValue: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#111827",
  },
  factRowSource: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 1,
  },
  inferredCaption: {
    fontSize: 11,
    color: "#9ca3af",
    lineHeight: 15,
    marginBottom: 8,
  },
  inferredCard: {
    borderLeftWidth: 3,
    borderLeftColor: "#4338ca",
    paddingLeft: 14,
    paddingVertical: 2,
    marginBottom: 10,
  },
  inferredValue: {
    fontSize: 14,
    fontWeight: "600",
    fontStyle: "italic",
    color: "#111827",
    lineHeight: 20,
  },
  inferredExcerpt: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  inferredSourceType: {
    fontSize: 11.5,
    color: "#4338ca",
    fontWeight: "600",
    marginTop: 4,
  },
  ctaButton: {
    backgroundColor: "#4338ca",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  ctaButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
});
