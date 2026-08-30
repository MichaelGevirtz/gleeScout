import { describe, expect, it } from "vitest";
import { deriveOtherProviderFacts } from "./otherProviderFacts.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { ConfirmedRequirement } from "./types.js";

const RETRIEVED_AT = "2026-08-28T12:00:00.000Z";

function fact<T>(value: T) {
  return { value, source: "example.com", sourceUrl: "https://example.com", retrievedAt: RETRIEVED_AT };
}

function candidateWith(fields: Partial<ProviderCandidate["fields"]>): ProviderCandidate {
  return { url: "https://example.com", fields };
}

describe("deriveOtherProviderFacts", () => {
  it("omits location when a location requirement is confirmed", () => {
    const candidate = candidateWith({ location: fact("DFW metroplex (Dallas, Fort Worth, Texas)") });
    const confirmed: ConfirmedRequirement[] = [{ label: "Texas", kind: "location" }];

    expect(deriveOtherProviderFacts(candidate, confirmed)).toEqual([]);
  });

  it("includes location verbatim when no location requirement is confirmed", () => {
    const candidate = candidateWith({ location: fact("DFW metroplex (Dallas, Fort Worth, Texas)") });

    expect(deriveOtherProviderFacts(candidate, [])).toEqual([
      { kind: "location", value: "DFW metroplex (Dallas, Fort Worth, Texas)" },
    ]);
  });

  it("excludes a services entry when serviceFact.includes(label)", () => {
    const candidate = candidateWith({ servicesOffered: fact(["baby shower photography sessions"]) });
    const confirmed: ConfirmedRequirement[] = [{ label: "baby shower", kind: "categoryAttribute" }];

    expect(deriveOtherProviderFacts(candidate, confirmed)).toEqual([]);
  });

  it("excludes a services entry when label.includes(serviceFact)", () => {
    const candidate = candidateWith({ servicesOffered: fact(["photographer"]) });
    const confirmed: ConfirmedRequirement[] = [
      { label: "baby shower photographer", kind: "serviceCategory" },
    ];

    expect(deriveOtherProviderFacts(candidate, confirmed)).toEqual([]);
  });

  it("keeps a services entry with no literal substring overlap in either direction", () => {
    const candidate = candidateWith({
      servicesOffered: fact(["corporate photography", "baby shower photographer"]),
    });
    const confirmed: ConfirmedRequirement[] = [
      { label: "baby shower photographer", kind: "serviceCategory" },
    ];

    expect(deriveOtherProviderFacts(candidate, confirmed)).toEqual([
      { kind: "servicesOffered", value: "corporate photography" },
    ]);
  });

  it("omits servicesOffered entirely when every entry overlaps a confirmed label", () => {
    const candidate = candidateWith({ servicesOffered: fact(["baby shower photography"]) });
    const confirmed: ConfirmedRequirement[] = [{ label: "baby shower", kind: "categoryAttribute" }];

    expect(deriveOtherProviderFacts(candidate, confirmed)).toEqual([]);
  });

  it("caps displayed services at 4 with a +N more suffix", () => {
    const candidate = candidateWith({
      servicesOffered: fact(["weddings", "maternity", "newborn", "family", "corporate", "headshots"]),
    });

    expect(deriveOtherProviderFacts(candidate, [])).toEqual([
      { kind: "servicesOffered", value: "weddings, maternity, newborn, family +2 more" },
    ]);
  });

  it("includes pricing/availability/policies/contactMethod verbatim when present", () => {
    const candidate = candidateWith({
      pricing: fact("$350 starting package"),
      availability: fact("Weekends only"),
      policies: fact("50% deposit required"),
      contactMethod: fact("hello@example.com"),
    });

    expect(deriveOtherProviderFacts(candidate, [])).toEqual([
      { kind: "pricing", value: "$350 starting package" },
      { kind: "availability", value: "Weekends only" },
      { kind: "policies", value: "50% deposit required" },
      { kind: "contactMethod", value: "hello@example.com" },
    ]);
  });

  it("omits each field independently when absent", () => {
    const candidate = candidateWith({ pricing: fact("$100") });

    expect(deriveOtherProviderFacts(candidate, [])).toEqual([{ kind: "pricing", value: "$100" }]);
  });

  it("never reads candidate.inferred", () => {
    const candidate: ProviderCandidate = {
      url: "https://example.com",
      fields: {},
      inferred: [
        {
          value: "Responsive to messages",
          evidenceSourceUrl: "https://reviews.example.com",
          sourceType: "google",
          retrievedAt: RETRIEVED_AT,
        },
      ],
    };

    expect(deriveOtherProviderFacts(candidate, [])).toEqual([]);
  });

  it("returns fields in a stable order: location, servicesOffered, pricing, availability, policies, contactMethod", () => {
    const candidate = candidateWith({
      contactMethod: fact("hello@example.com"),
      policies: fact("50% deposit"),
      availability: fact("Weekends only"),
      pricing: fact("$350"),
      servicesOffered: fact(["corporate photography"]),
      location: fact("Austin, TX"),
    });

    expect(deriveOtherProviderFacts(candidate, [])).toEqual([
      { kind: "location", value: "Austin, TX" },
      { kind: "servicesOffered", value: "corporate photography" },
      { kind: "pricing", value: "$350" },
      { kind: "availability", value: "Weekends only" },
      { kind: "policies", value: "50% deposit" },
      { kind: "contactMethod", value: "hello@example.com" },
    ]);
  });
});
