import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { ChatScreen } from "./ChatScreen";
import type { ConversationState } from "../domain/types";

function baseState(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    sessionId: "s1",
    phase: "gathering",
    serviceCategory: null,
    coreAttributes: {},
    categoryAttributes: {},
    messages: [],
    ...overrides,
  };
}

describe("ChatScreen transcript", () => {
  it("renders every message in state.messages in order", async () => {
    const state = baseState({
      messages: [
        { role: "assistant", content: "Hey! Tell me about your event." },
        { role: "user", content: "A birthday party in Austin." },
        { role: "assistant", content: "Got it, what date?" },
      ],
    });

    await render(<ChatScreen state={state} onSend={jest.fn()} />);

    expect(screen.getByTestId("chat-message-0")).toBeTruthy();
    expect(screen.getByTestId("chat-message-1")).toBeTruthy();
    expect(screen.getByTestId("chat-message-2")).toBeTruthy();

    expect(screen.getByText("Hey! Tell me about your event.")).toBeTruthy();
    expect(screen.getByText("A birthday party in Austin.")).toBeTruthy();
    expect(screen.getByText("Got it, what date?")).toBeTruthy();
  });
});

describe("ChatScreen sending", () => {
  it("typing and sending calls onSend with the typed text", async () => {
    const onSend = jest.fn().mockResolvedValue(baseState());
    await render(<ChatScreen state={baseState()} onSend={onSend} />);

    await fireEvent.changeText(screen.getByTestId("chat-input"), "Hello there");
    await fireEvent.press(screen.getByTestId("chat-send"));

    expect(onSend).toHaveBeenCalledWith("Hello there");
  });

  it("a successful onSend clears the input and leaves no lingering pending/failed bubble", async () => {
    const onSend = jest.fn().mockResolvedValue(baseState());
    await render(<ChatScreen state={baseState()} onSend={onSend} />);

    await fireEvent.changeText(screen.getByTestId("chat-input"), "Hello there");
    await act(async () => {
      await fireEvent.press(screen.getByTestId("chat-send"));
    });

    expect(screen.getByTestId("chat-input").props.value).toBe("");
    expect(screen.queryByTestId("chat-pending-message")).toBeNull();
  });

  it("a rejected onSend marks the bubble as failed, shows the real error message, keeps it visible, and retry re-sends the same text", async () => {
    const onSend = jest
      .fn()
      .mockRejectedValueOnce(
        new Error("You've hit the rate limit — please wait a moment and try again.")
      );
    await render(<ChatScreen state={baseState()} onSend={onSend} />);

    await fireEvent.changeText(screen.getByTestId("chat-input"), "Hello there");
    await act(async () => {
      await fireEvent.press(screen.getByTestId("chat-send"));
    });

    // Transcript/bubble is not cleared — the failed attempt is still visible.
    expect(screen.getByTestId("chat-pending-message")).toBeTruthy();
    expect(screen.getByText("Hello there")).toBeTruthy();
    expect(screen.getByTestId("chat-failed-message")).toHaveTextContent(
      "You've hit the rate limit — please wait a moment and try again."
    );
    expect(screen.getByTestId("chat-retry")).toBeTruthy();

    onSend.mockResolvedValueOnce(baseState());
    await act(async () => {
      await fireEvent.press(screen.getByTestId("chat-retry"));
    });

    expect(onSend).toHaveBeenCalledTimes(2);
    expect(onSend).toHaveBeenNthCalledWith(2, "Hello there");
    expect(screen.queryByTestId("chat-pending-message")).toBeNull();
  });

  it("a rejected onSend with a non-Error throw falls back to a generic failed message", async () => {
    const onSend = jest.fn().mockRejectedValueOnce("some non-Error rejection");
    await render(<ChatScreen state={baseState()} onSend={onSend} />);

    await fireEvent.changeText(screen.getByTestId("chat-input"), "Hello there");
    await act(async () => {
      await fireEvent.press(screen.getByTestId("chat-send"));
    });

    expect(screen.getByTestId("chat-failed-message")).toHaveTextContent("Failed to send.");
  });
});

describe("ChatScreen chip bar", () => {
  it("renders exactly one chip per known field, with the correct count badge", async () => {
    const state = baseState({
      serviceCategory: "Bounce house rental",
      coreAttributes: { dateTime: "2026-06-15", location: undefined },
      categoryAttributes: {
        guestCount: { description: "Guests", importance: "required", value: "30" },
        indoorOutdoor: { description: "Indoor/outdoor", importance: "optional", value: null },
      },
    });

    await render(<ChatScreen state={state} onSend={jest.fn()} />);

    expect(screen.getByTestId("chip-serviceCategory")).toBeTruthy();
    expect(screen.getByTestId("chip-dateTime")).toBeTruthy();
    expect(screen.getByTestId("chip-guestCount")).toBeTruthy();
    expect(screen.queryByTestId("chip-location")).toBeNull();
    expect(screen.queryByTestId("chip-indoorOutdoor")).toBeNull();

    expect(screen.getByTestId("chip-count")).toHaveTextContent("3");
  });

  it("hides the chip bar entirely for a state with nothing known yet", async () => {
    await render(<ChatScreen state={baseState()} onSend={jest.fn()} />);

    expect(screen.queryByTestId("chat-chip-bar")).toBeNull();
    expect(screen.queryByTestId("chip-count")).toBeNull();
    expect(screen.queryByTestId("chip-serviceCategory")).toBeNull();
    expect(screen.queryByTestId("chip-dateTime")).toBeNull();
    expect(screen.queryByTestId("chip-location")).toBeNull();
  });
});

describe("ChatScreen recap chips", () => {
  it("shows a newly-known field as a recap chip on the latest assistant bubble after a state update", async () => {
    const initialState = baseState({
      serviceCategory: "Bounce house rental",
      messages: [
        { role: "assistant", content: "Hey! Tell me about your event." },
        { role: "user", content: "A bounce house in Austin." },
        { role: "assistant", content: "Got it — what date?" },
      ],
    });

    const { rerender } = await render(<ChatScreen state={initialState} onSend={jest.fn()} />);

    const updatedState = baseState({
      serviceCategory: "Bounce house rental",
      coreAttributes: { location: "Austin, TX" },
      messages: [
        ...initialState.messages,
        { role: "user", content: "June 15th" },
        { role: "assistant", content: "Perfect — what's your budget?" },
      ],
    });

    await rerender(<ChatScreen state={updatedState} onSend={jest.fn()} />);

    // "location" became known between the two renders — it should show
    // as a recap chip on the new latest assistant bubble.
    const lastAssistantIndex = updatedState.messages.length - 1;
    const lastBubble = screen.getByTestId(`chat-message-${lastAssistantIndex}`);
    expect(lastBubble).toBeTruthy();
    expect(screen.getByTestId("recap-chip-location")).toBeTruthy();
  });
});

describe("ChatScreen Scout presence", () => {
  it("renders Scout exactly once, on the latest assistant message only", async () => {
    const state = baseState({
      messages: [
        { role: "assistant", content: "Hey! Tell me about your event." },
        { role: "user", content: "A birthday party in Austin." },
        { role: "assistant", content: "Got it, what date?" },
      ],
    });

    await render(<ChatScreen state={state} onSend={jest.fn()} />);

    expect(screen.getAllByTestId("chat-scout")).toHaveLength(1);
    // Attached to the newest assistant turn...
    expect(
      within(screen.getByTestId("chat-message-2")).getByTestId("chat-scout")
    ).toBeTruthy();
    // ...and absent from the earlier assistant turn.
    expect(
      within(screen.getByTestId("chat-message-0")).queryByTestId("chat-scout")
    ).toBeNull();
  });

  it("moves Scout to the new latest assistant message after a state update", async () => {
    const initialState = baseState({
      messages: [
        { role: "assistant", content: "Hey! Tell me about your event." },
        { role: "user", content: "A bounce house in Austin." },
        { role: "assistant", content: "Got it — what date?" },
      ],
    });

    const { rerender } = await render(<ChatScreen state={initialState} onSend={jest.fn()} />);

    const updatedState = baseState({
      messages: [
        ...initialState.messages,
        { role: "user", content: "June 15th" },
        { role: "assistant", content: "Perfect — what's your budget?" },
      ],
    });

    await rerender(<ChatScreen state={updatedState} onSend={jest.fn()} />);

    expect(screen.getAllByTestId("chat-scout")).toHaveLength(1);
    expect(
      within(screen.getByTestId("chat-message-4")).getByTestId("chat-scout")
    ).toBeTruthy();
    expect(
      within(screen.getByTestId("chat-message-2")).queryByTestId("chat-scout")
    ).toBeNull();
  });

  it("omits Scout when there is no assistant message yet", async () => {
    const state = baseState({
      messages: [{ role: "user", content: "I need a bounce house." }],
    });

    await render(<ChatScreen state={state} onSend={jest.fn()} />);

    expect(screen.queryByTestId("chat-scout")).toBeNull();
  });

  it("omits Scout for an empty transcript", async () => {
    await render(<ChatScreen state={baseState()} onSend={jest.fn()} />);

    expect(screen.queryByTestId("chat-scout")).toBeNull();
  });
});
