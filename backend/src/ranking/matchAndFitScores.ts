import type { CategoryAttributeSlot } from "../domain/conversation.js";
import type { ProviderCandidate } from "../domain/provider.js";
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
  if (!candidate.fields.servicesOffered && !candidate.fields.policies) {
    return null;
  }
  const combinedText = `${servicesText} ${policiesText}`.toLowerCase();

  const budgetEntry = findBudgetAttribute(requirements.categoryAttributes);
  const budgetKey = budgetEntry?.[0];

  const valuesToCheck = Object.entries(requirements.categoryAttributes)
    .filter(([key, slot]) => key !== budgetKey && slot.value !== null)
    .map(([, slot]) => slot.value as string);

  if (valuesToCheck.length === 0) {
    return null;
  }

  const matchedCount = valuesToCheck.filter((value) =>
    combinedText.includes(value.toLowerCase()),
  ).length;

  return matchedCount / valuesToCheck.length;
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
