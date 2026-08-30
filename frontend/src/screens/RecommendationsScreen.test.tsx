import { fireEvent, render, screen } from "@testing-library/react-native";
import { RecommendationsScreen } from "./RecommendationsScreen";
import type {
  Fact,
  Inferred,
  ProviderCandidate,
  ProviderScore,
  RankingDimension,
} from "../domain/types";

function fact<T>(value: T): Fact<T> {
  return {
    value,
    source: "example.com",
    sourceUrl: "https://example.com",
    retrievedAt: "2026-08-29T00:00:00.000Z",
  };
}

function inferred(value: string): Inferred<string> {
  return {
    value,
    evidenceSourceUrl: "https://reviews.example.com",
    sourceType: "google",
    retrievedAt: "2026-08-29T00:00:00.000Z",
  };
}

const ALL_NULL_DIMENSIONS: Record<RankingDimension, number | null> = {
  requirementMatch: null,
  geoFit: null,
  priceFit: null,
  reputation: null,
  evidenceQuality: null,
};

function makeCandidate(overrides: Partial<ProviderCandidate> = {}): ProviderCandidate {
  return {
    url: "https://acme-catering.com/about",
    fields: {
      name: fact("Acme Catering"),
      pricing: fact("$500-$1000"),
    },
    ...overrides,
  };
}

function makeProvider(overrides: Partial<ProviderScore> = {}): ProviderScore {
  return {
    candidate: makeCandidate(),
    score: 0.8,
    dimensionScores: {
      ...ALL_NULL_DIMENSIONS,
      requirementMatch: 0.9,
      reputation: 0.7,
    },
    explanation: "Strong match on requirements with solid reputation.",
    fitScore: 0.9,
    matchGrade: "wonderful",
    confirmedRequirements: [{ label: "Austin, TX", kind: "location" }],
    otherFacts: [],
    ...overrides,
  };
}

describe("RecommendationsScreen", () => {
  it("renders exactly providers.length rows for a 1-provider fixture, no extras", async () => {
    const providers = [makeProvider()];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.getByTestId("provider-row-0")).toBeTruthy();
    expect(screen.queryByTestId("provider-row-1")).toBeNull();
  });

  it("renders exactly providers.length rows for a 3-provider fixture, no extras", async () => {
    const providers = [makeProvider(), makeProvider(), makeProvider()];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.getByTestId("provider-row-0")).toBeTruthy();
    expect(screen.getByTestId("provider-row-1")).toBeTruthy();
    expect(screen.getByTestId("provider-row-2")).toBeTruthy();
    expect(screen.queryByTestId("provider-row-3")).toBeNull();
  });

  it("renders exactly providers.length rows for a 5-provider fixture, no extras", async () => {
    const providers = [
      makeProvider(),
      makeProvider(),
      makeProvider(),
      makeProvider(),
      makeProvider(),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    for (let i = 0; i < 5; i += 1) {
      expect(screen.getByTestId(`provider-row-${i}`)).toBeTruthy();
    }
    expect(screen.queryByTestId("provider-row-5")).toBeNull();
  });

  it("shows the fact name when fields.name is present", async () => {
    const providers = [
      makeProvider({
        candidate: makeCandidate({
          fields: { name: fact("Acme Catering") },
        }),
      }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.getByTestId("provider-row-0-name")).toHaveTextContent("Acme Catering");
  });

  it("falls back to the URL's hostname when fields.name is absent", async () => {
    const providers = [
      makeProvider({
        candidate: makeCandidate({
          url: "https://no-name-provider.com/page",
          fields: {},
        }),
      }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.getByTestId("provider-row-0-name")).toHaveTextContent("no-name-provider.com");
  });

  it("omits the pricing other-fact row entirely when it's not present in otherFacts", async () => {
    const providers = [
      makeProvider({
        candidate: makeCandidate({
          fields: { name: fact("No Price Co") },
        }),
        otherFacts: [],
      }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.queryByTestId("other-provider-fact-pricing")).toBeNull();
  });

  it("renders the pricing other-fact row verbatim when otherFacts includes it", async () => {
    const providers = [
      makeProvider({
        otherFacts: [{ kind: "pricing", value: "$350 starting package" }],
      }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.getByTestId("other-provider-fact-pricing")).toHaveTextContent("$350 starting package");
  });

  it("omits the rating row entirely when fields.rating is absent", async () => {
    const providers = [
      makeProvider({
        candidate: makeCandidate({
          fields: { name: fact("No Rating Co") },
        }),
      }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.queryByTestId("provider-row-0-rating")).toBeNull();
  });

  it("renders the labeled simulated reputation line, replacing the fact rating line, when both mock fields are present", async () => {
    const providers = [
      makeProvider({
        candidate: makeCandidate({
          fields: { name: fact("Blended Co"), rating: fact(4.9), reviewCount: fact(500) },
          reputationRating: 4.3,
          reputationReviewCount: 217,
        }),
      }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    const rating = screen.getByTestId("provider-row-0-rating");
    expect(rating).toHaveTextContent("★ 4.3 · 217 reviews (simulated)");
    expect(rating).not.toHaveTextContent("4.9", { exact: false });
    expect(rating).not.toHaveTextContent("500", { exact: false });
  });

  it("falls back to the existing fact rating line when mock reputation fields are absent", async () => {
    const providers = [
      makeProvider({
        candidate: makeCandidate({
          fields: { name: fact("Fact Only Co"), rating: fact(4.2), reviewCount: fact(50) },
        }),
      }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    const rating = screen.getByTestId("provider-row-0-rating");
    expect(rating).toHaveTextContent("★ 4.2 (50 reviews)");
    expect(rating).not.toHaveTextContent("simulated", { exact: false });
  });

  it("renders the mock reputation line below/separate from the match grade badge", async () => {
    const providers = [
      makeProvider({
        candidate: makeCandidate({
          reputationRating: 3.8,
          reputationReviewCount: 90,
        }),
      }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    const serialized = JSON.stringify(screen.toJSON());
    const badgeIndex = serialized.indexOf('"match-grade-label"');
    const ratingIndex = serialized.indexOf('"provider-row-0-rating"');

    expect(badgeIndex).toBeGreaterThan(-1);
    expect(ratingIndex).toBeGreaterThan(badgeIndex);
  });

  it("no longer renders fact/inferred counter text anywhere on the screen", async () => {
    const providers = [
      makeProvider({
        candidate: makeCandidate({
          fields: { name: fact("Mixed Co"), pricing: fact("$100"), rating: fact(4.5) },
          inferred: [inferred("Responsive to messages"), inferred("Clean venue")],
        }),
      }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.queryByTestId("provider-row-0-facts")).toBeNull();
    expect(screen.queryByTestId("provider-row-0-inferred")).toBeNull();
    const serialized = JSON.stringify(screen.toJSON());
    expect(serialized).not.toContain("facts sourced");
    expect(serialized).not.toContain("inferred");
  });

  it("no longer renders the sort control on a non-empty screen", async () => {
    const providers = [makeProvider()];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.queryByTestId("sort-control")).toBeNull();
    const serialized = JSON.stringify(screen.toJSON());
    expect(serialized).not.toContain("Sort: Best match");
  });

  it("renders a checkmark row for every confirmed requirement when all are confirmed", async () => {
    const providers = [
      makeProvider({
        confirmedRequirements: [
          { label: "baby shower photographer", kind: "serviceCategory" },
          { label: "Texas", kind: "location" },
          { label: "baby shower", kind: "categoryAttribute" },
        ],
      }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.getByTestId("confirmed-requirement-0")).toHaveTextContent("✓ baby shower photographer");
    expect(screen.getByTestId("confirmed-requirement-1")).toHaveTextContent("✓ Texas");
    expect(screen.getByTestId("confirmed-requirement-2")).toHaveTextContent("✓ baby shower");
  });

  it("renders a single checkmark row when only one requirement is confirmed", async () => {
    const providers = [
      makeProvider({ confirmedRequirements: [{ label: "Texas", kind: "location" }] }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.getByTestId("confirmed-requirement-0")).toHaveTextContent("✓ Texas");
    expect(screen.queryByTestId("confirmed-requirement-1")).toBeNull();
  });

  it("renders only the confirmed subset when some requirements are confirmed and others are not", async () => {
    const providers = [
      makeProvider({
        confirmedRequirements: [
          { label: "Texas", kind: "location" },
          { label: "baby shower", kind: "categoryAttribute" },
        ],
      }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.getByTestId("confirmed-requirement-0")).toHaveTextContent("✓ Texas");
    expect(screen.getByTestId("confirmed-requirement-1")).toHaveTextContent("✓ baby shower");
    expect(screen.queryByTestId("confirmed-requirement-2")).toBeNull();
  });

  it("never substitutes the provider's own service-area FACT text for the user's requested location label", async () => {
    const providers = [
      makeProvider({
        candidate: makeCandidate({
          fields: {
            name: fact("Skylight Photography"),
            location: fact(
              "The Woodlands, Cypress, Tomball, Waller, Magnolia, Montgomery, Conroe, Spring, and northwest Houston",
            ),
          },
        }),
        confirmedRequirements: [{ label: "Texas", kind: "location" }],
      }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.getByTestId("confirmed-requirement-0")).toHaveTextContent("✓ Texas");
    expect(screen.getByTestId("confirmed-requirement-0")).not.toHaveTextContent("Woodlands", { exact: false });
  });

  it("renders the match grade badge with the correct label and reputation shown separately", async () => {
    const providers = [
      makeProvider({
        matchGrade: "good",
        candidate: makeCandidate({
          fields: { name: fact("Good Co"), rating: fact(4.2), reviewCount: fact(50) },
        }),
      }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.getByTestId("match-grade-label")).toHaveTextContent("Good match");
    expect(screen.getByTestId("provider-row-0-rating")).toHaveTextContent("★ 4.2 (50 reviews)");
  });

  it("renders the insufficient_data grade without the word 'Poor'", async () => {
    const providers = [makeProvider({ matchGrade: "insufficient_data", fitScore: null })];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.getByTestId("match-grade-label")).toHaveTextContent("Not enough information to assess fit");
  });

  it("never renders a raw numeric fitScore or a percentage string anywhere", async () => {
    const providers = [makeProvider({ fitScore: 0.83, matchGrade: "wonderful" })];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    const serialized = JSON.stringify(screen.toJSON());
    expect(serialized).not.toContain("0.83");
    expect(serialized).not.toMatch(/\d+%/);
  });

  it("never renders the generated explanation text on the card (e.g. 'serves your area')", async () => {
    const explanation = "serves your area; within your stated budget ($300).";
    const providers = [makeProvider({ explanation })];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.queryByTestId("provider-row-0-rationale")).toBeNull();
    const serialized = JSON.stringify(screen.toJSON());
    expect(serialized).not.toContain("serves your area");
  });

  it("shows other confirmed FACTs (WHAT WE FOUND) below the confirmed requirements", async () => {
    const providers = [
      makeProvider({
        otherFacts: [
          { kind: "servicesOffered", value: "corporate photography" },
          { kind: "policies", value: "50% deposit required" },
        ],
      }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.getByTestId("other-provider-fact-servicesOffered")).toHaveTextContent(
      "corporate photography",
    );
    expect(screen.getByTestId("other-provider-fact-policies")).toHaveTextContent("50% deposit required");
  });

  it("omits the other-facts section entirely when otherFacts is empty", async () => {
    const providers = [makeProvider({ otherFacts: [] })];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.queryByTestId("other-provider-facts")).toBeNull();
  });

  it("calls onSelectRow with the exact same ProviderScore object on tap, unreshaped", async () => {
    const providers = [makeProvider(), makeProvider()];
    const onSelectRow = jest.fn();
    await render(
      <RecommendationsScreen providers={providers} onSelectRow={onSelectRow} onViewTrace={jest.fn()} />
    );

    await fireEvent.press(screen.getByTestId("provider-row-1"));

    expect(onSelectRow).toHaveBeenCalledTimes(1);
    expect(onSelectRow.mock.calls[0][0]).toBe(providers[1]);
  });

  it("renders the personalized heading, subtitle, and provider count above the list", async () => {
    const providers = [makeProvider(), makeProvider(), makeProvider()];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.getByTestId("recommendations-heading")).toHaveTextContent("Your best matches");
    expect(screen.getByTestId("recommendations-subtitle")).toHaveTextContent("Based on your requirements");
    expect(screen.getByTestId("recommendations-count")).toHaveTextContent("3 providers");
  });

  it("omits the heading block when providers is empty", async () => {
    await render(<RecommendationsScreen providers={[]} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    expect(screen.queryByTestId("recommendations-header")).toBeNull();
  });

  it("renders the trace link after the provider list, not before it", async () => {
    const providers = [makeProvider(), makeProvider()];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={jest.fn()} />);

    const serialized = JSON.stringify(screen.toJSON());
    const lastRowIndex = serialized.indexOf('"provider-row-1"');
    const traceLinkIndex = serialized.indexOf('"view-trace-link"');
    const headingIndex = serialized.indexOf('"recommendations-header"');

    expect(headingIndex).toBeLessThan(lastRowIndex);
    expect(traceLinkIndex).toBeGreaterThan(lastRowIndex);
  });

  it("renders an empty-state message and no rows when providers is empty", async () => {
    const onSelectRow = jest.fn();
    await render(
      <RecommendationsScreen providers={[]} onSelectRow={onSelectRow} onViewTrace={jest.fn()} />
    );

    expect(screen.getByTestId("recommendations-empty")).toBeTruthy();
    expect(screen.queryByTestId("provider-row-0")).toBeNull();
    expect(screen.queryByTestId("sort-control")).toBeNull();
  });

  it("renders the trace link and calls onViewTrace when pressed, with providers present", async () => {
    const providers = [makeProvider()];
    const onViewTrace = jest.fn();
    await render(
      <RecommendationsScreen providers={providers} onSelectRow={jest.fn()} onViewTrace={onViewTrace} />
    );

    await fireEvent.press(screen.getByTestId("view-trace-link"));

    expect(onViewTrace).toHaveBeenCalledTimes(1);
  });

  it("renders the trace link and calls onViewTrace when pressed, with an empty providers list", async () => {
    const onViewTrace = jest.fn();
    await render(<RecommendationsScreen providers={[]} onSelectRow={jest.fn()} onViewTrace={onViewTrace} />);

    await fireEvent.press(screen.getByTestId("view-trace-link"));

    expect(onViewTrace).toHaveBeenCalledTimes(1);
  });
});
