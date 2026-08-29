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
    ...overrides,
  };
}

describe("RecommendationsScreen", () => {
  it("renders exactly providers.length rows for a 1-provider fixture, no extras", async () => {
    const providers = [makeProvider()];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} />);

    expect(screen.getByTestId("provider-row-0")).toBeTruthy();
    expect(screen.queryByTestId("provider-row-1")).toBeNull();
  });

  it("renders exactly providers.length rows for a 3-provider fixture, no extras", async () => {
    const providers = [makeProvider(), makeProvider(), makeProvider()];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} />);

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
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} />);

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
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} />);

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
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} />);

    expect(screen.getByTestId("provider-row-0-name")).toHaveTextContent("no-name-provider.com");
  });

  it("shows an em-dash, never a fabricated number, when fields.pricing is absent", async () => {
    const providers = [
      makeProvider({
        candidate: makeCandidate({
          fields: { name: fact("No Price Co") },
        }),
      }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} />);

    expect(screen.getByTestId("provider-row-0-price")).toHaveTextContent("—");
  });

  it("matches known facts-sourced / inferred / signals counts for a mixed fixture", async () => {
    const providers = [
      makeProvider({
        candidate: makeCandidate({
          fields: {
            name: fact("Mixed Co"),
            pricing: fact("$100"),
            rating: fact(4.5),
          },
          inferred: [inferred("Responsive to messages"), inferred("Clean venue")],
        }),
        dimensionScores: {
          requirementMatch: 0.9,
          geoFit: 0.5,
          priceFit: 0.6,
          reputation: null,
          evidenceQuality: null,
        },
      }),
    ];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} />);

    expect(screen.getByTestId("provider-row-0-facts")).toHaveTextContent("3 facts sourced");
    expect(screen.getByTestId("provider-row-0-inferred")).toHaveTextContent("2 inferred");
    expect(screen.getByTestId("provider-row-0-signals")).toHaveTextContent("Signals: 3 / 5");
  });

  it("renders the explanation verbatim as the one-line rationale", async () => {
    const explanation = "Ranks highly due to exact date match and top-tier reviews.";
    const providers = [makeProvider({ explanation })];
    await render(<RecommendationsScreen providers={providers} onSelectRow={jest.fn()} />);

    expect(screen.getByTestId("provider-row-0-rationale")).toHaveTextContent(explanation);
  });

  it("calls onSelectRow with the exact same ProviderScore object on tap, unreshaped", async () => {
    const providers = [makeProvider(), makeProvider()];
    const onSelectRow = jest.fn();
    await render(<RecommendationsScreen providers={providers} onSelectRow={onSelectRow} />);

    await fireEvent.press(screen.getByTestId("provider-row-1"));

    expect(onSelectRow).toHaveBeenCalledTimes(1);
    expect(onSelectRow.mock.calls[0][0]).toBe(providers[1]);
  });

  it("renders an empty-state message and no rows when providers is empty", async () => {
    const onSelectRow = jest.fn();
    await render(<RecommendationsScreen providers={[]} onSelectRow={onSelectRow} />);

    expect(screen.getByTestId("recommendations-empty")).toBeTruthy();
    expect(screen.queryByTestId("provider-row-0")).toBeNull();
    expect(screen.queryByTestId("sort-control")).toBeNull();
  });
});
