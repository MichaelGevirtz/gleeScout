import { fireEvent, render, screen } from "@testing-library/react-native";
import ErrorState from "./ErrorState";

describe("ErrorState", () => {
  it("renders the given message", async () => {
    await render(<ErrorState message="We couldn't reach the server." onRetry={() => {}} />);

    expect(screen.getByTestId("error-message")).toHaveTextContent(
      "We couldn't reach the server.",
    );
  });

  it("calls onRetry exactly once per tap", async () => {
    const onRetry = jest.fn();
    await render(<ErrorState message="Something went wrong." onRetry={onRetry} />);

    await fireEvent.press(screen.getByTestId("error-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId("error-retry"));
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});
