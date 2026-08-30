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

  if (requirements.serviceCategory) {
    const text = factText(candidate, true);
    if (text.includes(requirements.serviceCategory.toLowerCase())) {
      confirmed.push({ label: requirements.serviceCategory, kind: "serviceCategory" });
    }
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
