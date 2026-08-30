import { render, screen } from "@testing-library/react-native";
import { OtherProviderFacts } from "./OtherProviderFacts";
import type { OtherProviderFact } from "../domain/types";

describe("OtherProviderFacts", () => {
  it("renders one row per fact with the exact value text", async () => {
    const facts: OtherProviderFact[] = [
      { kind: "pricing", value: "$350 starting package" },
      { kind: "policies", value: "50% deposit required" },
    ];

    await render(<OtherProviderFacts facts={facts} />);

    expect(screen.getByTestId("other-provider-fact-pricing")).toHaveTextContent("$350 starting package");
    expect(screen.getByTestId("other-provider-fact-policies")).toHaveTextContent("50% deposit required");
  });

  it("renders nothing when given an empty array", async () => {
    await render(<OtherProviderFacts facts={[]} />);

    expect(screen.queryByTestId("other-provider-facts")).toBeNull();
  });

  it("renders a value at or under 100 characters unchanged", async () => {
    const value = "a".repeat(100);
    await render(<OtherProviderFacts facts={[{ kind: "policies", value }]} />);

    expect(screen.getByTestId("other-provider-fact-policies")).toHaveTextContent(value);
  });

  it("truncates a value over 100 characters with an ellipsis", async () => {
    const value = "a".repeat(150);
    await render(<OtherProviderFacts facts={[{ kind: "policies", value }]} />);

    const rendered = screen.getByTestId("other-provider-fact-policies");
    expect(rendered).toHaveTextContent(`${"a".repeat(100)}…`);
    expect(rendered).not.toHaveTextContent(value);
  });
});
