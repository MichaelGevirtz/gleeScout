import { renderHook } from "@testing-library/react-native";
import { DESKTOP_BREAKPOINT, useIsDesktop } from "./useIsDesktop";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUseWindowDimensions: jest.Mock = jest.requireMock(
  "react-native/Libraries/Utilities/useWindowDimensions"
).default;

beforeEach(() => {
  jest.resetAllMocks();
});

describe("useIsDesktop", () => {
  it("returns false for a width below the breakpoint", async () => {
    mockedUseWindowDimensions.mockReturnValue({ width: DESKTOP_BREAKPOINT - 1, height: 800 });

    const { result } = await renderHook(() => useIsDesktop());

    expect(result.current).toBe(false);
  });

  it("returns true for a width at or above the breakpoint", async () => {
    mockedUseWindowDimensions.mockReturnValue({ width: DESKTOP_BREAKPOINT, height: 800 });

    const { result } = await renderHook(() => useIsDesktop());

    expect(result.current).toBe(true);
  });

  it("re-renders with the new value when the mocked width changes", async () => {
    mockedUseWindowDimensions.mockReturnValue({ width: 500, height: 800 });

    const { result, rerender } = await renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);

    mockedUseWindowDimensions.mockReturnValue({ width: 1200, height: 800 });
    await rerender({});

    expect(result.current).toBe(true);
  });
});
