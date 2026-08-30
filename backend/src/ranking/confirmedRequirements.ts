import type { ProviderCandidate } from "../domain/provider.js";
import { geoFitScore } from "./matchAndFitScores.js";
import type { ConfirmedRequirement, RankingRequirements } from "./types.js";

// Same lexical-substring convention as matchAndFitScores.ts's
// requirementMatchScore (D13d) — a documented, accepted limitation
// (e.g. "bounce house" won't match "inflatable"), not a new one
// introduced here. serviceCategory additionally checks the
// provider's own `name` FACT, since a business name frequently
// states its service line directly (e.g. "Austin Bounce House
// Rentals"); category attributes stay scoped to
// servicesOffered/policies only, mirroring requirementMatchScore's
// exact existing convention.
function factText(candidate: ProviderCandidate, includeName: boolean): string {
  const parts = [
    includeName ? candidate.fields.name?.value : undefined,
    candidate.fields.servicesOffered?.value.join(" "),
    candidate.fields.policies?.value,
  ].filter((part): part is string => part != null);
  return parts.join(" ").toLowerCase();
}

// Generic qualifiers a user's serviceCategory phrase often carries
// that a provider's own FACT text frequently omits (e.g. "bounce
// house rental" vs. a provider's "Bounce Houses & Jumps"). Stripped
// from the trailing end of the phrase only, before the substring
// check — never applied to categoryAttributes or FACT text itself.
const GENERIC_CATEGORY_SUFFIXES = [
  "rentals",
  "rental",
  "services",
  "service",
  "providers",
  "provider",
  "company",
];

function normalizeServiceCategory(category: string): string {
  let normalized = category.toLowerCase().trim();
  let strippedSomething = true;
  while (strippedSomething) {
    strippedSomething = false;
    for (const suffix of GENERIC_CATEGORY_SUFFIXES) {
      const withoutSuffix = normalized.replace(new RegExp(`\\s+${suffix}$`), "");
      if (withoutSuffix !== normalized && withoutSuffix.length > 0) {
        normalized = withoutSuffix;
        strippedSomething = true;
        break;
      }
    }
  }
  return normalized;
}

/**
 * Single source of truth for "does this candidate's FACT text
 * (name/servicesOffered/policies) confirm this serviceCategory
 * phrase" — used by both `deriveConfirmedRequirements` (checklist)
 * and `requirementMatchScore` (ranking dimension), so the two never
 * drift apart.
 */
export function serviceCategoryMatches(
  candidate: ProviderCandidate,
  serviceCategory: string,
): boolean {
  const text = factText(candidate, true);
  return text.includes(normalizeServiceCategory(serviceCategory));
}

function findBudgetKey(
  categoryAttributes: RankingRequirements["categoryAttributes"],
): string | undefined {
  return Object.entries(categoryAttributes).find(
    ([key, slot]) => /budget/i.test(key) && slot.value !== null,
  )?.[0];
}

/**
 * Which of the user's stated requirements this candidate's FACT
 * evidence confirms. Never considers `candidate.inferred`
 * (INFERRED) or reputation — an entry only appears here when the
 * requirement's value is directly supported by FACT text. `dateTime`
 * is never checked: no FACT field represents "available on this
 * specific date" (`availability` is free text, not date-specific),
 * so a check would structurally never succeed. Budget is excluded,
 * same as requirementMatchScore — it's a price-fit concept, not a
 * text-match concept.
 */
export function deriveConfirmedRequirements(
  candidate: ProviderCandidate,
  requirements: RankingRequirements,
): ConfirmedRequirement[] {
  const confirmed: ConfirmedRequirement[] = [];

  if (requirements.serviceCategory && serviceCategoryMatches(candidate, requirements.serviceCategory)) {
    confirmed.push({ label: requirements.serviceCategory, kind: "serviceCategory" });
  }

  if (requirements.location && geoFitScore(candidate, requirements) === 1) {
    confirmed.push({ label: requirements.location, kind: "location" });
  }

  const budgetKey = findBudgetKey(requirements.categoryAttributes);
  const attributeText = factText(candidate, false);
  for (const [key, slot] of Object.entries(requirements.categoryAttributes)) {
    if (key === budgetKey || slot.value === null) continue;
    if (attributeText.includes(slot.value.toLowerCase())) {
      confirmed.push({ label: slot.value, kind: "categoryAttribute" });
    }
  }

  return confirmed;
}

/**
 * Every requirement the checks above consider, regardless of any
 * candidate's text — i.e. the same three checks as
 * `deriveConfirmedRequirements`, minus the "does this candidate's
 * FACT text include it" step. Used by the trace (M13) to name which
 * specific requirements a zero-confirmed-requirements candidate
 * failed on: for such a candidate, every catalog entry here is by
 * definition unmatched, since confirming even one would have kept it
 * out of the zero-confirmed case.
 */
export function deriveRequirementCatalog(requirements: RankingRequirements): ConfirmedRequirement[] {
  const catalog: ConfirmedRequirement[] = [];

  if (requirements.serviceCategory) {
    catalog.push({ label: requirements.serviceCategory, kind: "serviceCategory" });
  }

  if (requirements.location) {
    catalog.push({ label: requirements.location, kind: "location" });
  }

  const budgetKey = findBudgetKey(requirements.categoryAttributes);
  for (const [key, slot] of Object.entries(requirements.categoryAttributes)) {
    if (key === budgetKey || slot.value === null) continue;
    catalog.push({ label: slot.value, kind: "categoryAttribute" });
  }

  return catalog;
}
