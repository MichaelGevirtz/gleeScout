import { act, render, screen } from "@testing-library/react-native";
import TransitionScreen from "./TransitionScreen";

describe("TransitionScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders all three step labels", async () => {
    await render(<TransitionScreen />);

    expect(screen.getByTestId("step-searching")).toBeTruthy();
    expect(screen.getByTestId("step-reviews")).toBeTruthy();
    expect(screen.getByTestId("step-ranking")).toBeTruthy();
  });

  it("cycles the active step over time as fake timers advance", async () => {
    await render(<TransitionScreen />);

    expect(screen.getByTestId("step-searching").props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId("step-reviews").props.accessibilityState).toEqual({ selected: false });
    expect(screen.getByTestId("step-ranking").props.accessibilityState).toEqual({ selected: false });

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });

    expect(screen.getByTestId("step-searching").props.accessibilityState).toEqual({ selected: false });
    expect(screen.getByTestId("step-reviews").props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId("step-ranking").props.accessibilityState).toEqual({ selected: false });

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });

    expect(screen.getByTestId("step-searching").props.accessibilityState).toEqual({ selected: false });
    expect(screen.getByTestId("step-reviews").props.accessibilityState).toEqual({ selected: false });
    expect(screen.getByTestId("step-ranking").props.accessibilityState).toEqual({ selected: true });

    // Cycles back around to the first step.
    await act(async () => {
      jest.advanceTimersByTime(1200);
    });

    expect(screen.getByTestId("step-searching").props.accessibilityState).toEqual({ selected: true });
  });

  it("clears its internal timer on unmount", async () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");

    const { unmount } = await render(<TransitionScreen />);
    await unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
