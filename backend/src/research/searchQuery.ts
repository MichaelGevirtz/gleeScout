import type { CategoryAttributeSlot } from "../domain/conversation.js";

export function buildProviderSearchQuery({
  serviceCategory,
  location,
}: {
  serviceCategory: string;
  location: string;
}): string {
  return `${serviceCategory} in ${location}`;
}

/**
 * Deterministic 2-3 query fan-out (no LLM call — see task-99). Query #3 is
 * omitted, not left with a dangling empty term, when no non-budget category
 * attribute has a value yet. Budget is excluded because it's a price-fit
 * number, not a search term (same convention as `findBudgetKey` in
 * ranking/confirmedRequirements.ts and ranking/matchAndFitScores.ts).
 */
export function buildProviderSearchQueries({
  serviceCategory,
  location,
  categoryAttributes,
}: {
  serviceCategory: string;
  location: string;
  categoryAttributes: Record<string, CategoryAttributeSlot>;
}): string[] {
  const queries = [
    buildProviderSearchQuery({ serviceCategory, location }),
    `${serviceCategory} ${location} reviews`,
  ];

  const requirementEntry = Object.entries(categoryAttributes).find(
    ([key, slot]) => !/budget/i.test(key) && slot.value !== null,
  );
  if (requirementEntry) {
    queries.push(`${serviceCategory} ${location} ${requirementEntry[1].value}`);
  }

  return queries;
}
