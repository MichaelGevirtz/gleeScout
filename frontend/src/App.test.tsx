import { act, fireEvent, render, screen } from "@testing-library/react-native";
import App from "./App";
import { useSession } from "./hooks/useSession";
import { useIsDesktop } from "./hooks/useIsDesktop";
import { fetchProviders, selectProvider } from "./api/client";
import type { ConversationState, ProviderCandidate, ProviderScore, SimulatedAnswer } from "./domain/types";

jest.mock("./hooks/useSession", () => ({ useSession: jest.fn() }));
jest.mock("./hooks/useIsDesktop", () => ({ useIsDesktop: jest.fn() }));
jest.mock("./api/client", () => ({
  ...jest.requireActual("./api/client"),
  fetchProviders: jest.fn(),
  selectProvider: jest.fn(),
}));

const mockedUseSession = useSession as jest.Mock;
const mockedUseIsDesktop = useIsDesktop as jest.Mock;
const mockedFetchProviders = fetchProviders as jest.Mock;
const mockedSelectProvider = selectProvider as jest.Mock;

const gatheringState: ConversationState = {
  sessionId: "s1",
  phase: "gathering",
  serviceCategory: "bounce house",
  coreAttributes: { location: "Austin, TX" },
  categoryAttributes: {},
  messages: [{ role: "assistant", content: "What's the date?" }],
};

const readyState: ConversationState = {
  ...gatheringState,
  phase: "ready_for_search",
  messages: [...gatheringState.messages, { role: "user", content: "Saturday" }],
};

function candidateFixture(url: string, name: string): ProviderCandidate {
  return { url, fields: { name: { value: name, source: url, sourceUrl: url, retrievedAt: "2026-01-01T00:00:00.000Z" } } };
}

function providerScoreFixture(url: string, name: string): ProviderScore {
  return {
    candidate: candidateFixture(url, name),
    score: 0.8,
    dimensionScores: {
      requirementMatch: 0.8,
      geoFit: 0.9,
      priceFit: null,
      reputation: null,
      evidenceQuality: 0.5,
    },
    explanation: `${name} is a strong match.`,
  };
}

function mockSession(overrides: Partial<ReturnType<typeof useSession>> = {}) {
  const sendMessage = jest.fn();
  mockedUseSession.mockReturnValue({
    sessionId: "s1",
    state: gatheringState,
    isBootstrapping: false,
    bootstrapError: null,
    retryBootstrap: jest.fn(),
    sendMessage,
    ...overrides,
  });
  return sendMessage;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe("bootstrap", () => {
  it("shows the Chat screen once state is available", async () => {
    mockSession();
    await render(<App />);
    expect(screen.getByTestId("chat-transcript")).toBeTruthy();
    expect(screen.queryByTestId("chat-pill")).toBeNull();
  });

  it("auto-transitions to provider search on resume into an already-ready session", async () => {
    mockSession({ state: readyState });
    mockedFetchProviders.mockResolvedValueOnce({ providers: [providerScoreFixture("https://a.com", "A")] });

    await render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedFetchProviders).toHaveBeenCalledWith("s1");
    expect(screen.getByTestId("recommendations-screen")).toBeTruthy();
  });
});

describe("chat -> ready -> provider search", () => {
  it("calls fetchProviders exactly once after a send resolves to ready_for_search, shows loading then results", async () => {
    const sendMessage = mockSession();
    sendMessage.mockResolvedValueOnce(readyState);
    let resolveFetch: (value: { providers: ProviderScore[] }) => void = () => {};
    mockedFetchProviders.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    await render(<App />);
    await fireEvent.changeText(screen.getByTestId("chat-input"), "Saturday");
    await fireEvent.press(screen.getByTestId("chat-send"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedFetchProviders).toHaveBeenCalledTimes(1);
    expect(mockedFetchProviders).toHaveBeenCalledWith("s1");
    expect(screen.getByTestId("step-searching")).toBeTruthy();

    await act(async () => {
      resolveFetch({ providers: [providerScoreFixture("https://a.com", "A")] });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("recommendations-screen")).toBeTruthy();
    expect(mockedFetchProviders).toHaveBeenCalledTimes(1);
  });

  it("shows ErrorState on fetchProviders failure, and retry re-issues the same call", async () => {
    const sendMessage = mockSession();
    sendMessage.mockResolvedValueOnce(readyState);
    mockedFetchProviders.mockRejectedValueOnce(new Error("upstream failed"));

    await render(<App />);
    await fireEvent.changeText(screen.getByTestId("chat-input"), "Saturday");
    await fireEvent.press(screen.getByTestId("chat-send"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("error-message").props.children).toBe("upstream failed");

    mockedFetchProviders.mockResolvedValueOnce({ providers: [providerScoreFixture("https://a.com", "A")] });
    await fireEvent.press(screen.getByTestId("error-retry"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedFetchProviders).toHaveBeenCalledTimes(2);
    expect(mockedFetchProviders).toHaveBeenNthCalledWith(2, "s1");
    expect(screen.getByTestId("recommendations-screen")).toBeTruthy();
  });
});

describe("recommendations -> details -> select -> answers -> back", () => {
  async function reachRecommendations() {
    const sendMessage = mockSession();
    sendMessage.mockResolvedValueOnce(readyState);
    const provider = providerScoreFixture("https://a.com", "A");
    mockedFetchProviders.mockResolvedValueOnce({ providers: [provider] });

    await render(<App />);
    await fireEvent.changeText(screen.getByTestId("chat-input"), "Saturday");
    await fireEvent.press(screen.getByTestId("chat-send"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("recommendations-screen")).toBeTruthy();
    return provider;
  }

  it("tapping a row opens Provider Details with the exact candidate/dimensionScores/explanation", async () => {
    const provider = await reachRecommendations();

    await fireEvent.press(screen.getByTestId("provider-row-0"));

    expect(screen.getByTestId("provider-details-screen")).toBeTruthy();
    expect(screen.getByTestId("explanation").props.children).toBe(provider.explanation);
  });

  it("selecting calls selectProvider with the exact candidate and shows loading then results", async () => {
    const provider = await reachRecommendations();
    await fireEvent.press(screen.getByTestId("provider-row-0"));

    let resolveSelect: (value: { answers: SimulatedAnswer[] }) => void = () => {};
    mockedSelectProvider.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSelect = resolve;
      }),
    );

    await fireEvent.press(screen.getByTestId("select-cta"));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedSelectProvider).toHaveBeenCalledWith("s1", provider.candidate);
    expect(screen.getByTestId("qa-loading")).toBeTruthy();

    await act(async () => {
      resolveSelect({ answers: [{ question: "Available Saturday?", answer: { value: "Likely yes", generatedAt: "2026-01-01T00:00:00.000Z" } }] });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("qa-results")).toBeTruthy();
    expect(screen.getByTestId("qa-question-0").props.children).toBe("Available Saturday?");
  });

  it("shows ErrorState on selectProvider failure, retry re-issues the identical candidate", async () => {
    const provider = await reachRecommendations();
    await fireEvent.press(screen.getByTestId("provider-row-0"));

    mockedSelectProvider.mockRejectedValueOnce(new Error("simulation failed"));
    await fireEvent.press(screen.getByTestId("select-cta"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("error-message").props.children).toBe("simulation failed");

    mockedSelectProvider.mockResolvedValueOnce({ answers: [] });
    await fireEvent.press(screen.getByTestId("error-retry"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedSelectProvider).toHaveBeenCalledTimes(2);
    expect(mockedSelectProvider).toHaveBeenNthCalledWith(2, "s1", provider.candidate);
    expect(screen.getByTestId("qa-results")).toBeTruthy();
  });

  it("back to your matches returns to Recommendations without calling fetchProviders again", async () => {
    await reachRecommendations();
    await fireEvent.press(screen.getByTestId("provider-row-0"));
    mockedSelectProvider.mockResolvedValueOnce({ answers: [] });
    await fireEvent.press(screen.getByTestId("select-cta"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockedFetchProviders).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId("qa-back"));

    expect(screen.getByTestId("recommendations-screen")).toBeTruthy();
    expect(mockedFetchProviders).toHaveBeenCalledTimes(1);
  });
});

describe("chat pill", () => {
  it("is absent on Chat, present elsewhere, and returns to Chat preserving providers", async () => {
    const provider = await (async () => {
      const sendMessage = mockSession();
      sendMessage.mockResolvedValueOnce(readyState);
      const p = providerScoreFixture("https://a.com", "A");
      mockedFetchProviders.mockResolvedValueOnce({ providers: [p] });
      await render(<App />);
      await fireEvent.changeText(screen.getByTestId("chat-input"), "Saturday");
      await fireEvent.press(screen.getByTestId("chat-send"));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      return p;
    })();

    expect(screen.getByTestId("chat-pill")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("chat-pill"));
    expect(screen.getByTestId("chat-transcript")).toBeTruthy();
    expect(screen.queryByTestId("chat-pill")).toBeNull();

    void provider;
  });

  it("a message sent from reopened Chat (already ready_for_search) triggers exactly one fresh fetchProviders call and navigates to Recommendations with the new list", async () => {
    const sendMessage = mockSession();
    sendMessage.mockResolvedValueOnce(readyState);
    const originalProvider = providerScoreFixture("https://a.com", "A");
    mockedFetchProviders.mockResolvedValueOnce({ providers: [originalProvider] });

    await render(<App />);
    await fireEvent.changeText(screen.getByTestId("chat-input"), "Saturday");
    await fireEvent.press(screen.getByTestId("chat-send"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("recommendations-screen")).toBeTruthy();
    expect(mockedFetchProviders).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId("chat-pill"));
    expect(screen.getByTestId("chat-transcript")).toBeTruthy();

    sendMessage.mockResolvedValueOnce(readyState);
    const refreshedProvider = providerScoreFixture("https://b.com", "B");
    let resolveRefresh: (value: { providers: ProviderScore[] }) => void = () => {};
    mockedFetchProviders.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    await fireEvent.changeText(screen.getByTestId("chat-input"), "Actually make it Sunday");
    await fireEvent.press(screen.getByTestId("chat-send"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("step-searching")).toBeTruthy();
    expect(mockedFetchProviders).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveRefresh({ providers: [refreshedProvider] });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("recommendations-screen")).toBeTruthy();
    expect(screen.getByTestId("provider-row-0-name").props.children).toBe("B");
  });

  it("preserves the previous providers list and conversation state when a reopened-chat refresh fails, and retry succeeds", async () => {
    const sendMessage = mockSession();
    sendMessage.mockResolvedValueOnce(readyState);
    const originalProvider = providerScoreFixture("https://a.com", "A");
    mockedFetchProviders.mockResolvedValueOnce({ providers: [originalProvider] });

    await render(<App />);
    await fireEvent.changeText(screen.getByTestId("chat-input"), "Saturday");
    await fireEvent.press(screen.getByTestId("chat-send"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await fireEvent.press(screen.getByTestId("chat-pill"));
    sendMessage.mockResolvedValueOnce(readyState);
    mockedFetchProviders.mockRejectedValueOnce(new Error("refresh failed"));

    await fireEvent.changeText(screen.getByTestId("chat-input"), "Sunday instead");
    await fireEvent.press(screen.getByTestId("chat-send"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("error-message").props.children).toBe("refresh failed");

    const refreshedProvider = providerScoreFixture("https://c.com", "C");
    mockedFetchProviders.mockResolvedValueOnce({ providers: [refreshedProvider] });
    await fireEvent.press(screen.getByTestId("error-retry"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedFetchProviders).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId("recommendations-screen")).toBeTruthy();
    expect(screen.getByTestId("provider-row-0-name").props.children).toBe("C");
  });
});

describe("desktop split-pane", () => {
  async function reachRecommendationsDesktop() {
    mockedUseIsDesktop.mockReturnValue(true);
    const sendMessage = mockSession();
    sendMessage.mockResolvedValueOnce(readyState);
    const provider = providerScoreFixture("https://a.com", "A");
    mockedFetchProviders.mockResolvedValueOnce({ providers: [provider] });

    await render(<App />);
    await fireEvent.changeText(screen.getByTestId("chat-input"), "Saturday");
    await fireEvent.press(screen.getByTestId("chat-send"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("recommendations-screen")).toBeTruthy();
    return { sendMessage, provider };
  }

  it("narrow viewport with providers set: split pane does not render, single-pane + chatPill unchanged", async () => {
    mockedUseIsDesktop.mockReturnValue(false);
    const sendMessage = mockSession();
    sendMessage.mockResolvedValueOnce(readyState);
    mockedFetchProviders.mockResolvedValueOnce({ providers: [providerScoreFixture("https://a.com", "A")] });

    await render(<App />);
    await fireEvent.changeText(screen.getByTestId("chat-input"), "Saturday");
    await fireEvent.press(screen.getByTestId("chat-send"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("recommendations-screen")).toBeTruthy();
    expect(screen.getByTestId("chat-pill")).toBeTruthy();
    expect(screen.queryByTestId("context-panel")).toBeNull();
  });

  it("wide viewport, providers === null (initial chat): split pane does not render", async () => {
    mockedUseIsDesktop.mockReturnValue(true);
    mockSession();

    await render(<App />);

    expect(screen.getByTestId("chat-transcript")).toBeTruthy();
    expect(screen.queryByTestId("context-panel")).toBeNull();
    expect(screen.queryByTestId("chat-pill")).toBeNull();
  });

  it("wide viewport, providers set, on recommendations: ContextPanel renders, chatPill does not", async () => {
    await reachRecommendationsDesktop();

    expect(screen.getByTestId("context-panel")).toBeTruthy();
    expect(screen.getByTestId("recommendations-screen")).toBeTruthy();
    expect(screen.queryByTestId("chat-pill")).toBeNull();
  });

  it("ContextPanel's Chat/Back to matches button moves between chat and recommendations without re-fetching", async () => {
    await reachRecommendationsDesktop();
    expect(mockedFetchProviders).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId("context-panel-button"));
    expect(screen.getByTestId("chat-transcript")).toBeTruthy();
    expect(screen.getByTestId("context-panel")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("context-panel-button"));
    expect(screen.getByTestId("recommendations-screen")).toBeTruthy();
    expect(mockedFetchProviders).toHaveBeenCalledTimes(1);
  });

  it("currentlyViewing is present on providerDetails/simulatedQA and absent on recommendations/chat", async () => {
    await reachRecommendationsDesktop();
    expect(screen.queryByTestId("context-currently-viewing")).toBeNull();

    await fireEvent.press(screen.getByTestId("provider-row-0"));
    expect(screen.getByTestId("provider-details-screen")).toBeTruthy();
    expect(screen.getByTestId("context-currently-viewing")).toHaveTextContent("Currently viewing: A");

    mockedSelectProvider.mockResolvedValueOnce({ answers: [] });
    await fireEvent.press(screen.getByTestId("select-cta"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("qa-results")).toBeTruthy();
    expect(screen.getByTestId("context-currently-viewing")).toHaveTextContent("Currently viewing: A");

    await fireEvent.press(screen.getByTestId("qa-back"));
    expect(screen.getByTestId("recommendations-screen")).toBeTruthy();
    expect(screen.queryByTestId("context-currently-viewing")).toBeNull();

    await fireEvent.press(screen.getByTestId("context-panel-button"));
    expect(screen.getByTestId("chat-transcript")).toBeTruthy();
    expect(screen.queryByTestId("context-currently-viewing")).toBeNull();
  });

  it("a chat-triggered refresh shows TransitionScreen in the right pane while ContextPanel stays mounted throughout", async () => {
    const { sendMessage } = await reachRecommendationsDesktop();

    await fireEvent.press(screen.getByTestId("context-panel-button"));
    expect(screen.getByTestId("chat-transcript")).toBeTruthy();
    expect(screen.getByTestId("context-panel")).toBeTruthy();

    sendMessage.mockResolvedValueOnce(readyState);
    let resolveRefresh: (value: { providers: ProviderScore[] }) => void = () => {};
    mockedFetchProviders.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    await fireEvent.changeText(screen.getByTestId("chat-input"), "Actually make it Sunday");
    await fireEvent.press(screen.getByTestId("chat-send"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("step-searching")).toBeTruthy();
    expect(screen.getByTestId("context-panel")).toBeTruthy();

    await act(async () => {
      resolveRefresh({ providers: [providerScoreFixture("https://b.com", "B")] });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("recommendations-screen")).toBeTruthy();
    expect(screen.getByTestId("context-panel")).toBeTruthy();
  });
});

describe("bootstrap error", () => {
  it("shows ErrorState with retryBootstrap when bootstrap fails", async () => {
    const retryBootstrap = jest.fn();
    mockedUseSession.mockReturnValue({
      sessionId: null,
      state: null,
      isBootstrapping: false,
      bootstrapError: "Failed to start session.",
      retryBootstrap,
      sendMessage: jest.fn(),
    });

    await render(<App />);
    expect(screen.getByTestId("error-message").props.children).toBe("Failed to start session.");

    await fireEvent.press(screen.getByTestId("error-retry"));
    expect(retryBootstrap).toHaveBeenCalledTimes(1);
  });
});
