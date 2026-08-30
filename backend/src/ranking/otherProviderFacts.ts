import type { ProviderCandidate } from "../domain/provider.js";
import type { ConfirmedRequirement, OtherProviderFact } from "./types.js";

const SERVICES_DISPLAY_CAP = 4;

// Same lexical-substring convention as confirmedRequirements.ts and
// matchAndFitScores.ts's requirementMatchScore (D13d) — a documented,
// accepted limitation (a paraphrased services entry like "Photography
// for baby showers" won't be recognized as overlapping a confirmed
// label like "baby shower photographer"), not a new one introduced
// here. No fuzzy/semantic fallback by design — literal substring only.
function overlapsConfirmedLabel(text: string, confirmedLabels: string[]): boolean {
  const lower = text.toLowerCase();
  return confirmedLabels.some((label) => lower.includes(label) || label.includes(lower));
}

/**
 * Additional useful FACT information about a candidate that isn't
 * already represented by its confirmed requirements — literal FACT
 * values only, never `candidate.inferred`, never generated/summarized
 * text. `location` and `servicesOffered` are deduplicated against
 * `confirmedRequirements`; `pricing`/`availability`/`policies`/
 * `contactMethod` are never requirement-matched elsewhere, so they're
 * always included verbatim when present.
 */
export function deriveOtherProviderFacts(
  candidate: ProviderCandidate,
  confirmedRequirements: ConfirmedRequirement[],
): OtherProviderFact[] {
  const facts: OtherProviderFact[] = [];
  const confirmedLabels = confirmedRequirements.map((r) => r.label.toLowerCase());
  const locationConfirmed = confirmedRequirements.some((r) => r.kind === "location");

  if (!locationConfirmed && candidate.fields.location) {
    facts.push({ kind: "location", value: candidate.fields.location.value });
  }

  const services = candidate.fields.servicesOffered?.value ?? [];
  const remainingServices = services.filter((service) => !overlapsConfirmedLabel(service, confirmedLabels));
  if (remainingServices.length > 0) {
    const shown = remainingServices.slice(0, SERVICES_DISPLAY_CAP);
    const extra = remainingServices.length - shown.length;
    const value = extra > 0 ? `${shown.join(", ")} +${extra} more` : shown.join(", ");
    facts.push({ kind: "servicesOffered", value });
  }

  if (candidate.fields.pricing) {
    facts.push({ kind: "pricing", value: candidate.fields.pricing.value });
  }
  if (candidate.fields.availability) {
    facts.push({ kind: "availability", value: candidate.fields.availability.value });
  }
  if (candidate.fields.policies) {
    facts.push({ kind: "policies", value: candidate.fields.policies.value });
  }
  if (candidate.fields.contactMethod) {
    facts.push({ kind: "contactMethod", value: candidate.fields.contactMethod.value });
  }

  return facts;
}
