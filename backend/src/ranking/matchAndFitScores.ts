import type { CategoryAttributeSlot } from "../domain/conversation.js";
import type { ProviderCandidate } from "../domain/provider.js";
import { serviceCategoryMatches } from "./confirmedRequirements.js";
import type { RankingRequirements } from "./types.js";

function findBudgetAttribute(
  categoryAttributes: Record<string, CategoryAttributeSlot>,
): [string, CategoryAttributeSlot] | undefined {
  return Object.entries(categoryAttributes).find(
    ([key, slot]) => /budget/i.test(key) && slot.value !== null,
  );
}

export function parseDollarAmount(text: string): number | null {
  const matches = text.match(/\$[\d,]+(?:\.\d+)?/g);
  if (!matches || matches.length !== 1) {
    return null;
  }
  const amount = Number(matches[0].slice(1).replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

export function requirementMatchScore(
  candidate: ProviderCandidate,
  requirements: RankingRequirements,
): number | null {
  const servicesText = candidate.fields.servicesOffered?.value.join(" ") ?? "";
  const policiesText = candidate.fields.policies?.value ?? "";
  // serviceCategory can also match via `name` (see confirmedRequirements.ts's
  // factText), so the "no evidence at all" guard now also accepts a
  // candidate with only a `name` fact — otherwise a real serviceCategory
  // match via name alone would be discarded before it's ever checked.
  if (!candidate.fields.servicesOffered && !candidate.fields.policies && !candidate.fields.name) {
    return null;
  }
  const combinedText = `${servicesText} ${policiesText}`.toLowerCase();

  const budgetEntry = findBudgetAttribute(requirements.categoryAttributes);
  const budgetKey = budgetEntry?.[0];

  const valuesToCheck = Object.entries(requirements.categoryAttributes)
    .filter(([key, slot]) => key !== budgetKey && slot.value !== null)
    .map(([, slot]) => slot.value as string);

  const checks = valuesToCheck.map((value) => combinedText.includes(value.toLowerCase()));

  if (requirements.serviceCategory) {
    checks.push(serviceCategoryMatches(candidate, requirements.serviceCategory));
  }

  if (checks.length === 0) {
    return null;
  }

  const matchedCount = checks.filter(Boolean).length;

  return matchedCount / checks.length;
}

export function geoFitScore(
  candidate: ProviderCandidate,
  requirements: RankingRequirements,
): number | null {
  const userLocation = requirements.location;
  const providerLocation = candidate.fields.location?.value;
  if (!userLocation || !providerLocation) {
    return null;
  }
  const a = userLocation.toLowerCase();
  const b = providerLocation.toLowerCase();
  return a.includes(b) || b.includes(a) ? 1 : 0;
}

export function priceFitScore(
  candidate: ProviderCandidate,
  requirements: RankingRequirements,
): number | null {
  const budgetEntry = findBudgetAttribute(requirements.categoryAttributes);
  if (!budgetEntry) {
    return null;
  }
  const budget = parseDollarAmount(budgetEntry[1].value as string);
  if (budget === null) {
    return null;
  }

  const pricingFact = candidate.fields.pricing;
  if (!pricingFact) {
    return null;
  }
  const providerPrice = parseDollarAmount(pricingFact.value);
  if (providerPrice === null) {
    return null;
  }

  if (providerPrice <= budget) {
    return 1;
  }
  return Math.max(0, 1 - (providerPrice - budget) / budget);
}
