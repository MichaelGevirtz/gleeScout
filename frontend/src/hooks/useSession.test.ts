import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSession } from "./useSession";
import { ApiError, createConversation, getConversation, sendMessage } from "../api/client";
import type { ConversationState } from "../domain/types";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock("../api/client", () => ({
  ...jest.requireActual("../api/client"),
  createConversation: jest.fn(),
  getConversation: jest.fn(),
  sendMessage: jest.fn(),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockedCreate = createConversation as jest.Mock;
const mockedGet = getConversation as jest.Mock;
const mockedSend = sendMessage as jest.Mock;

const state: ConversationState = {
  sessionId: "s1",
  phase: "gathering",
  serviceCategory: null,
  coreAttributes: {},
  categoryAttributes: {},
  messages: [],
};

beforeEach(() => {
  jest.resetAllMocks();
});

describe("useSession bootstrap", () => {
  it("creates a fresh session when no sessionId is stored", async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(null);
    mockedCreate.mockResolvedValueOnce({ sessionId: "s1", state });

    const { result } = await renderHook(() => useSession());

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));

    expect(mockedGet).not.toHaveBeenCalled();
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith("glee-scout-session-id", "s1");
    expect(result.current.sessionId).toBe("s1");
    expect(result.current.state).toEqual(state);
    expect(result.current.bootstrapError).toBeNull();
  });

  it("resumes an existing session when getConversation succeeds", async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce("s1");
    mockedGet.mockResolvedValueOnce({ state });

    const { result } = await renderHook(() => useSession());

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(result.current.sessionId).toBe("s1");
    expect(result.current.state).toEqual(state);
  });

  it("falls through to creating a fresh session when the stored id 404s", async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce("stale-id");
    mockedGet.mockRejectedValueOnce(new ApiError(404, "Session not found"));
    mockedCreate.mockResolvedValueOnce({ sessionId: "s2", state: { ...state, sessionId: "s2" } });

    const { result } = await renderHook(() => useSession());

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));

    expect(result.current.sessionId).toBe("s2");
    expect(result.current.bootstrapError).toBeNull();
  });

  it("sets bootstrapError on a non-404 resume failure and leaves state null", async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce("s1");
    mockedGet.mockRejectedValueOnce(new ApiError(500, "boom"));

    const { result } = await renderHook(() => useSession());

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));

    expect(result.current.bootstrapError).toBe("boom");
    expect(result.current.state).toBeNull();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  describe("on web", () => {
    const originalPlatformOS = Platform.OS;

    beforeEach(() => {
      Platform.OS = "web";
    });

    afterEach(() => {
      Platform.OS = originalPlatformOS;
    });

    it("never reads stored session id and always creates a fresh session", async () => {
      mockedCreate.mockResolvedValueOnce({ sessionId: "s1", state });

      const { result } = await renderHook(() => useSession());

      await waitFor(() => expect(result.current.isBootstrapping).toBe(false));

      expect(mockedAsyncStorage.getItem).not.toHaveBeenCalled();
      expect(mockedGet).not.toHaveBeenCalled();
      expect(mockedCreate).toHaveBeenCalledTimes(1);
      expect(result.current.sessionId).toBe("s1");
    });

    it("never writes the new session id to storage", async () => {
      mockedCreate.mockResolvedValueOnce({ sessionId: "s1", state });

      await renderHook(() => useSession());

      await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
      expect(mockedAsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  it("retryBootstrap re-runs the full sequence", async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(null);
    mockedCreate.mockRejectedValueOnce(new Error("network down"));

    const { result } = await renderHook(() => useSession());
    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));
    expect(result.current.bootstrapError).toBe("network down");

    mockedAsyncStorage.getItem.mockResolvedValueOnce(null);
    mockedCreate.mockResolvedValueOnce({ sessionId: "s1", state });

    await act(async () => {
      result.current.retryBootstrap();
    });
    await waitFor(() => expect(result.current.bootstrapError).toBeNull());

    expect(result.current.sessionId).toBe("s1");
  });
});

describe("useSession.sendMessage", () => {
  it("replaces state wholesale on success and resolves with it", async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(null);
    mockedCreate.mockResolvedValueOnce({ sessionId: "s1", state });

    const { result } = await renderHook(() => useSession());
    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));

    const nextState: ConversationState = { ...state, messages: [{ role: "user", content: "hi" }] };
    mockedSend.mockResolvedValueOnce({ state: nextState });

    let resolved: ConversationState | undefined;
    await act(async () => {
      resolved = await result.current.sendMessage("hi");
    });

    expect(resolved).toEqual(nextState);
    await waitFor(() => expect(result.current.state).toEqual(nextState));
  });

  it("leaves state unchanged and rejects on failure", async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(null);
    mockedCreate.mockResolvedValueOnce({ sessionId: "s1", state });

    const { result } = await renderHook(() => useSession());
    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));

    mockedSend.mockRejectedValueOnce(new ApiError(502, "upstream failed"));

    await act(async () => {
      await expect(result.current.sendMessage("hi")).rejects.toMatchObject({ status: 502 });
    });
    expect(result.current.state).toEqual(state);
  });
});
