import { render, screen } from "@testing-library/react-native";
import SelectedProviderHeader from "./SelectedProviderHeader";

describe("SelectedProviderHeader", () => {
  it("renders the 'Selected provider' label and the given provider name", async () => {
    await render(<SelectedProviderHeader providerName="Acme Bounce Houses" />);

    expect(screen.getByTestId("selected-provider-header")).toBeTruthy();
    expect(screen.getByTestId("selected-provider-header-label").props.children).toBe(
      "Selected provider",
    );
    expect(screen.getByTestId("selected-provider-header-name").props.children).toBe(
      "Acme Bounce Houses",
    );
  });
});
