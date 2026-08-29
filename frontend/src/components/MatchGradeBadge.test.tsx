import { render, screen } from "@testing-library/react-native";
import { MatchGradeBadge } from "./MatchGradeBadge";
import type { MatchGrade } from "../domain/types";

describe("MatchGradeBadge", () => {
  it.each<[MatchGrade, string, string]>([
    ["wonderful", "Wonderful match", "Meets your stated requirements very well"],
    ["good", "Good match", "Meets most of your stated requirements"],
    ["average", "Average match", "Partially meets your stated requirements"],
    ["poor", "Poor match", "Meets few of your stated requirements"],
    [
      "insufficient_data",
      "Not enough information to assess fit",
      "We don't have enough data yet to judge how well this fits what you asked for",
    ],
  ])("renders the correct label and explanation for grade=%s", async (grade, label, explanation) => {
    await render(<MatchGradeBadge grade={grade} />);

    expect(screen.getByTestId("match-grade-label")).toHaveTextContent(label);
    expect(screen.getByTestId("match-grade-explanation")).toHaveTextContent(explanation);
  });

  it("never renders the word 'Poor' for the insufficient_data grade", async () => {
    await render(<MatchGradeBadge grade="insufficient_data" />);

    expect(screen.getByTestId("match-grade-label")).not.toHaveTextContent(/poor/i);
  });
});
