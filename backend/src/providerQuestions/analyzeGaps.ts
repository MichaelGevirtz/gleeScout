import type { ConversationState } from "../domain/conversation.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { ProviderGap } from "./types.js";

const PRICING_INCLUSION_KEYWORDS = ["setup", "teardown", "cleanup", "insur", "deliver", "includ"];

function findBudgetValue(state: ConversationState): string | undefined {
  for (const [name, slot] of Object.entries(state.categoryAttributes)) {
    if (/budget/i.test(name) && slot.value !== null) {
      return slot.value;
    }
  }
  return undefined;
}

function analyzeAvailabilityGap(candidate: ProviderCandidate, state: ConversationState): ProviderGap | null {
  const dateTime = state.coreAttributes.dateTime;
  if (!dateTime) {
    return null;
  }

  const availability = candidate.fields.availability?.value;
  if (availability && availability.toLowerCase().includes(dateTime.toLowerCase())) {
    return null;
  }

  return {
    topic: "availability",
    description: `Confirm availability for ${dateTime}.`,
  };
}

function analyzeRequirementFitGaps(candidate: ProviderCandidate, state: ConversationState): ProviderGap[] {
  const servicesText = candidate.fields.servicesOffered?.value.join(" ") ?? "";
  const policiesText = candidate.fields.policies?.value ?? "";
  const inferredText = (candidate.inferred ?? [])
    .map((tag) => `${tag.value} ${tag.evidenceExcerpt ?? ""}`)
    .join(" ");
  const combinedText = `${servicesText} ${policiesText} ${inferredText}`.toLowerCase();

  const gaps: ProviderGap[] = [];
  for (const [name, slot] of Object.entries(state.categoryAttributes)) {
    if (slot.importance !== "required" || slot.value === null || /budget/i.test(name)) {
      continue;
    }
    if (combinedText.includes(slot.value.toLowerCase())) {
      continue;
    }
    gaps.push({
      topic: "requirementFit",
      description: `Confirm the provider can meet this requirement: ${name} (${slot.description}) — requested: "${slot.value}".`,
    });
  }
  return gaps;
}

function analyzePricingGap(candidate: ProviderCandidate, state: ConversationState): ProviderGap | null {
  const budget = findBudgetValue(state);
  if (budget === undefined) {
    return null;
  }

  const pricing = candidate.fields.pricing?.value;
  if (pricing === undefined) {
    return {
      topic: "pricing",
      description: "Pricing information is not yet known for this provider.",
    };
  }

  const mentionsInclusions = PRICING_INCLUSION_KEYWORDS.some((keyword) =>
    pricing.toLowerCase().includes(keyword),
  );
  if (mentionsInclusions) {
    return null;
  }

  return {
    topic: "pricing",
    description: `Confirm what the quoted price (${pricing}) includes (e.g. setup, teardown, insurance).`,
  };
}

export function analyzeProviderGaps({
  candidate,
  state,
}: {
  candidate: ProviderCandidate;
  state: ConversationState;
}): ProviderGap[] {
  const gaps: ProviderGap[] = [];

  const availabilityGap = analyzeAvailabilityGap(candidate, state);
  if (availabilityGap) {
    gaps.push(availabilityGap);
  }

  gaps.push(...analyzeRequirementFitGaps(candidate, state));

  const pricingGap = analyzePricingGap(candidate, state);
  if (pricingGap) {
    gaps.push(pricingGap);
  }

  return gaps;
}
