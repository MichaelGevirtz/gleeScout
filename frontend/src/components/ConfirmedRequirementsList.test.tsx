import { render, screen } from "@testing-library/react-native";
import { ConfirmedRequirementsList } from "./ConfirmedRequirementsList";
import type { ConfirmedRequirement } from "../domain/types";

describe("ConfirmedRequirementsList", () => {
  it("renders one row per entry with a checkmark and the exact label text, in input order", async () => {
    const requirements: ConfirmedRequirement[] = [
      { label: "baby shower photographer", kind: "serviceCategory" },
      { label: "Texas", kind: "location" },
      { label: "baby shower", kind: "categoryAttribute" },
    ];

    await render(<ConfirmedRequirementsList requirements={requirements} />);

    expect(screen.getByTestId("confirmed-requirement-0")).toHaveTextContent("✓ baby shower photographer");
    expect(screen.getByTestId("confirmed-requirement-1")).toHaveTextContent("✓ Texas");
    expect(screen.getByTestId("confirmed-requirement-2")).toHaveTextContent("✓ baby shower");
  });

  it("renders nothing when given an empty array", async () => {
    await render(<ConfirmedRequirementsList requirements={[]} />);

    expect(screen.queryByTestId("confirmed-requirements-list")).toBeNull();
  });
});
