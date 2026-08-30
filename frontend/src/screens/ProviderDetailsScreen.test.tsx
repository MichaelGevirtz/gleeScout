import { fireEvent, render, screen, within } from "@testing-library/react-native";
import ProviderDetailsScreen from "./ProviderDetailsScreen";
import type { Fact, ProviderCandidate } from "../domain/types";

function fact<T>(value: T, source = "acmebouncehouses.com"): Fact<T> {
  return {
    value,
    source,
    sourceUrl: `https://${source}`,
    retrievedAt: "2026-08-29T00:00:00Z",
  };
}

const fullCandidate: ProviderCandidate = {
  url: "https://www.acmebouncehouses.com/rentals",
  fields: {
    name: fact("Acme Bounce Houses"),
    location: fact("Austin, TX"),
    servicesOffered: fact(["bounce houses", "water slides"]),
    pricing: fact("$250/day"),
    rating: fact(4.8, "google.com"),
    reviewCount: fact(120, "google.com"),
  },
  inferred: [
    {
      value: "Great with toddlers",
      evidenceSourceUrl: "https://www.yelp.com/biz/acme",
      evidenceExcerpt: "my 3 year old had a blast",
      sourceType: "yelp",
      retrievedAt: "2026-08-29T00:00:00Z",
    },
    {
      value: "Fast setup",
      evidenceSourceUrl: "https://www.acmebouncehouses.com/reviews",
      sourceType: "provider_website",
      retrievedAt: "2026-08-29T00:00:00Z",
    },
  ],
};

const noop = () => {};

describe("ProviderDetailsScreen — selected provider header", () => {
  it("renders the header at the top with the FACT name when present", async () => {
    await render(
      <ProviderDetailsScreen candidate={fullCandidate} matchGrade="good" onSelectProvider={noop} />,
    );

    expect(screen.getByTestId("selected-provider-header")).toBeTruthy();
    expect(screen.getByTestId("selected-provider-header-label").props.children).toBe(
      "Selected provider",
    );
    expect(screen.getByTestId("selected-provider-header-name").props.children).toBe(
      "Acme Bounce Houses",
    );
  });

  it("falls back to the URL's hostname when fields.name is absent", async () => {
    const candidateWithoutName: ProviderCandidate = {
      url: "https://www.bouncy-fun-rentals.com/",
      fields: {
        pricing: fact("$300/day"),
      },
    };

    await render(
      <ProviderDetailsScreen candidate={candidateWithoutName} matchGrade="good" onSelectProvider={noop} />,
    );

    expect(screen.getByTestId("selected-provider-header-name").props.children).toBe(
      "www.bouncy-fun-rentals.com",
    );
  });
});

describe("ProviderDetailsScreen — match grade", () => {
  it("renders the MatchGradeBadge for the given grade", async () => {
    await render(
      <ProviderDetailsScreen candidate={fullCandidate} matchGrade="wonderful" onSelectProvider={noop} />,
    );

    expect(screen.getByTestId("match-grade-badge")).toBeTruthy();
  });

  it("never renders internal scoring dimension UI", async () => {
    await render(
      <ProviderDetailsScreen candidate={fullCandidate} matchGrade="good" onSelectProvider={noop} />,
    );

    expect(screen.queryByTestId("dimension-bars")).toBeNull();
    expect(screen.queryByTestId("dimension-group-fit")).toBeNull();
    expect(screen.queryByTestId("dimension-group-quality")).toBeNull();
    expect(screen.queryByText("Requirement fit")).toBeNull();
    expect(screen.queryByText("Reputation & evidence")).toBeNull();
    expect(screen.queryByText(/affect the match grade/)).toBeNull();
    expect(screen.queryByText("Not enough data")).toBeNull();
  });
});

describe("ProviderDetailsScreen — reputation", () => {
  it("renders the blended reputation rating/count with a quiet, honest disclosure", async () => {
    const candidateWithReputation: ProviderCandidate = {
      ...fullCandidate,
      reputationRating: 4.3,
      reputationReviewCount: 217,
    };

    await render(
      <ProviderDetailsScreen candidate={candidateWithReputation} matchGrade="good" onSelectProvider={noop} />,
    );

    expect(screen.getByTestId("reputation-line-text").props.children).toBe("★ 4.3 · 217 reviews");
    const disclosure = screen.getByTestId("reputation-line-disclosure");
    expect(disclosure).toHaveTextContent("Mock data for demo", { exact: false });

    // Must never reuse M11's SIMULATED/NOT CONFIRMED disclosure language
    // on the reputation line itself (the unrelated INFERRED caption
    // elsewhere on the page legitimately contains "not confirmed").
    expect(disclosure).not.toHaveTextContent(/simulated/i, { exact: false });
    expect(disclosure).not.toHaveTextContent(/not confirmed/i, { exact: false });
  });

  it("renders nothing when reputationRating/reputationReviewCount are absent", async () => {
    await render(
      <ProviderDetailsScreen candidate={fullCandidate} matchGrade="good" onSelectProvider={noop} />,
    );

    expect(screen.queryByTestId("reputation-line")).toBeNull();
  });
});

describe("ProviderDetailsScreen — sourced facts", () => {
  it("renders one fact row per non-null fields.* entry, with value + source caption", async () => {
    await render(
      <ProviderDetailsScreen candidate={fullCandidate} matchGrade="good" onSelectProvider={noop} />,
    );

    // "name" never gets its own row — it's already shown in the header
    // above, so a separate fact row would just repeat it.
    expect(screen.queryByTestId("fact-row-name")).toBeNull();

    expect(screen.getByTestId("fact-row-location-value").props.children).toBe("Austin, TX");
    expect(screen.getByTestId("fact-row-servicesOffered-value").props.children).toBe(
      "bounce houses, water slides",
    );
    expect(screen.getByTestId("fact-row-pricing-value").props.children).toBe("$250/day");
    expect(screen.getByTestId("fact-row-rating-value").props.children).toBe("4.8");
    expect(screen.getByTestId("fact-row-reviewCount-value").props.children).toBe("120");

    // Fields never set on this candidate get no row at all.
    expect(screen.queryByTestId("fact-row-availability")).toBeNull();
    expect(screen.queryByTestId("fact-row-policies")).toBeNull();
    expect(screen.queryByTestId("fact-row-contactMethod")).toBeNull();
  });

  it("renders a long value in full, for wrapping rather than truncation", async () => {
    const longLocation =
      "Austin, Texas (Service areas include Round Rock, Pflugerville, Georgetown, Cedar Park, Leander, Hutto, Liberty Hill, Killeen, Taylor)";
    const candidateWithLongLocation: ProviderCandidate = {
      ...fullCandidate,
      fields: { ...fullCandidate.fields, location: fact(longLocation) },
    };

    await render(
      <ProviderDetailsScreen candidate={candidateWithLongLocation} matchGrade="good" onSelectProvider={noop} />,
    );

    expect(screen.getByTestId("fact-row-location-value").props.children).toBe(longLocation);
  });
});

describe("ProviderDetailsScreen — photo gallery", () => {
  it("renders nothing when fields.photos is unset", async () => {
    await render(
      <ProviderDetailsScreen candidate={fullCandidate} matchGrade="good" onSelectProvider={noop} />,
    );

    expect(screen.queryByTestId("photo-gallery")).toBeNull();
  });

  it("uses the first photo as the hero and the rest (capped at 6) as the filmstrip, with a '+N' chip for the remainder", async () => {
    const urls = Array.from({ length: 9 }, (_, i) => `https://cdn.example.com/photo-${i}.jpg`);
    const candidateWithPhotos: ProviderCandidate = {
      ...fullCandidate,
      fields: { ...fullCandidate.fields, photos: fact(urls, "wenphoto.net") },
    };

    await render(
      <ProviderDetailsScreen candidate={candidateWithPhotos} matchGrade="good" onSelectProvider={noop} />,
    );

    expect(screen.getByTestId("photo-gallery-hero").props.source).toEqual({ uri: urls[0] });

    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`photo-gallery-filmstrip-image-${i}`).props.source).toEqual({
        uri: urls[i + 1],
      });
    }
    expect(screen.queryByTestId("photo-gallery-filmstrip-image-6")).toBeNull();

    // 9 total - 1 hero - 6 filmstrip = 2 remaining.
    expect(screen.getByTestId("photo-gallery-more")).toHaveTextContent("+2");
  });

  it("renders only a hero, no filmstrip or '+N' chip, when there's a single photo", async () => {
    const candidateWithOnePhoto: ProviderCandidate = {
      ...fullCandidate,
      fields: {
        ...fullCandidate.fields,
        photos: fact(["https://cdn.example.com/only.jpg"], "wenphoto.net"),
      },
    };

    await render(
      <ProviderDetailsScreen candidate={candidateWithOnePhoto} matchGrade="good" onSelectProvider={noop} />,
    );

    expect(screen.getByTestId("photo-gallery-hero")).toBeTruthy();
    expect(screen.queryByTestId("photo-gallery-filmstrip-image-0")).toBeNull();
    expect(screen.queryByTestId("photo-gallery-more")).toBeNull();
  });
});

describe("ProviderDetailsScreen — inferred from reviews", () => {
  it("renders one inferred card per inferred[] entry; excerpt shown only when present", async () => {
    await render(
      <ProviderDetailsScreen candidate={fullCandidate} matchGrade="good" onSelectProvider={noop} />,
    );

    expect(screen.getByTestId("inferred-card-0-value").props.children).toBe("Great with toddlers");
    expect(screen.getByTestId("inferred-card-0-excerpt")).toBeTruthy();
    expect(screen.getByTestId("inferred-card-0-source-type").props.children).toBe("Yelp review");

    expect(screen.getByTestId("inferred-card-1-value").props.children).toBe("Fast setup");
    // No evidenceExcerpt on this entry — the quote line must be omitted
    // entirely, not rendered as an empty string.
    expect(screen.queryByTestId("inferred-card-1-excerpt")).toBeNull();
    expect(screen.getByTestId("inferred-card-1-source-type").props.children).toBe(
      "provider website review",
    );
  });

  it("omits the entire section, including the caption, when inferred is an empty array", async () => {
    const candidateWithNoInferred: ProviderCandidate = {
      ...fullCandidate,
      inferred: [],
    };

    await render(
      <ProviderDetailsScreen candidate={candidateWithNoInferred} matchGrade="good" onSelectProvider={noop} />,
    );

    expect(screen.queryByTestId("inferred-section")).toBeNull();
    expect(
      screen.queryByText("Inferred from review patterns — not confirmed by the provider."),
    ).toBeNull();
    expect(screen.queryAllByTestId(/^inferred-card-/)).toHaveLength(0);
  });

  it("omits the entire section when inferred is absent", async () => {
    const { inferred: _inferred, ...rest } = fullCandidate;
    const candidateWithoutInferred = rest as ProviderCandidate;

    await render(
      <ProviderDetailsScreen candidate={candidateWithoutInferred} matchGrade="good" onSelectProvider={noop} />,
    );

    expect(screen.queryByTestId("inferred-section")).toBeNull();
  });
});

describe("ProviderDetailsScreen — FACT/INFERRED structural separation", () => {
  it("never renders FACT and INFERRED rows inside the same list container", async () => {
    await render(
      <ProviderDetailsScreen candidate={fullCandidate} matchGrade="good" onSelectProvider={noop} />,
    );

    const factList = screen.getByTestId("fact-list");
    const inferredList = screen.getByTestId("inferred-list");

    // The fact-list container holds only fact rows, never inferred cards.
    expect(within(factList).queryAllByTestId(/^inferred-card-/)).toHaveLength(0);
    expect(within(factList).getAllByTestId(/^fact-row-/).length).toBeGreaterThan(0);

    // The inferred-list container holds only inferred cards, never fact rows.
    expect(within(inferredList).queryAllByTestId(/^fact-row-/)).toHaveLength(0);
    expect(within(inferredList).getAllByTestId(/^inferred-card-/).length).toBeGreaterThan(0);

    // The two containers are structurally distinct nodes, not one shared list.
    expect(factList).not.toBe(inferredList);
  });
});

describe("ProviderDetailsScreen — sticky CTA footer", () => {
  it("renders the sticky footer as a sibling of the scrollable content, not inside it", async () => {
    await render(
      <ProviderDetailsScreen candidate={fullCandidate} matchGrade="good" onSelectProvider={noop} />,
    );

    const footer = screen.getByTestId("sticky-footer");
    expect(within(footer).getByTestId("select-cta")).toBeTruthy();

    // The footer is not nested inside the fact/inferred sections — it's a
    // sibling of the scrollable body, so it stays visible while that scrolls.
    expect(within(footer).queryByTestId("fact-section")).toBeNull();
    expect(within(footer).queryByTestId("inferred-section")).toBeNull();
  });

  it("tapping 'Select [name]' calls onSelectProvider with the exact candidate object", async () => {
    const onSelectProvider = jest.fn();

    await render(
      <ProviderDetailsScreen candidate={fullCandidate} matchGrade="good" onSelectProvider={onSelectProvider} />,
    );

    expect(screen.getByText("Select Acme Bounce Houses")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("select-cta"));

    expect(onSelectProvider).toHaveBeenCalledTimes(1);
    expect(onSelectProvider).toHaveBeenCalledWith(fullCandidate);
    // Must be the exact same object reference, not a reshaped copy.
    expect(onSelectProvider.mock.calls[0][0]).toBe(fullCandidate);
  });

  it("falls back to the URL's hostname for the CTA label when fields.name is absent", async () => {
    const candidateWithoutName: ProviderCandidate = {
      url: "https://www.bouncy-fun-rentals.com/",
      fields: {
        pricing: fact("$300/day"),
      },
    };

    await render(
      <ProviderDetailsScreen candidate={candidateWithoutName} matchGrade="good" onSelectProvider={noop} />,
    );

    expect(screen.getByText("Select www.bouncy-fun-rentals.com")).toBeTruthy();
  });
});
