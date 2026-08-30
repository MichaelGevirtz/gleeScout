import { render, screen } from "@testing-library/react-native";
import { MatchGradeBadge } from "./MatchGradeBadge";
import type { MatchGrade } from "../domain/types";

describe("MatchGradeBadge", () => {
  it.each<[MatchGrade, string]>([
    ["wonderful", "Wonderful match"],
    ["good", "Good match"],
    ["average", "Average match"],
    ["poor", "Poor match"],
    ["insufficient_data", "Not enough information to assess fit"],
  ])("renders the correct label for grade=%s, with no subtitle text", async (grade, label) => {
    await render(<MatchGradeBadge grade={grade} />);

    expect(screen.getByTestId("match-grade-label")).toHaveTextContent(label);
    expect(screen.queryByTestId("match-grade-explanation")).toBeNull();
  });

  it("never renders the word 'Poor' for the insufficient_data grade", async () => {
    await render(<MatchGradeBadge grade="insufficient_data" />);

    expect(screen.getByTestId("match-grade-label")).not.toHaveTextContent(/poor/i);
  });
});
