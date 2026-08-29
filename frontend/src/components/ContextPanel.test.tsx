import { fireEvent, render, screen } from "@testing-library/react-native";
import ContextPanel from "./ContextPanel";
import type { ConversationState } from "../domain/types";

const baseState: ConversationState = {
  sessionId: "s1",
  phase: "ready_for_search",
  serviceCategory: "bounce house rental",
  coreAttributes: { dateTime: "next Saturday", location: "Austin, TX" },
  categoryAttributes: {
    guestCount: { description: "Number of guests", importance: "required", value: "30" },
    theme: { description: "Party theme", importance: "optional", value: null },
  },
  messages: [],
};

function baseProps() {
  return {
    state: baseState,
    matchCount: 3,
    isChatOpen: false,
    onOpenChat: jest.fn(),
    onBackToMatches: jest.fn(),
  };
}

describe("ContextPanel", () => {
  it("renders serviceCategory/dateTime/location from the given ConversationState", async () => {
    await render(<ContextPanel {...baseProps()} />);

    expect(screen.getByTestId("context-row-serviceCategory-value")).toHaveTextContent(
      "bounce house rental",
    );
    expect(screen.getByTestId("context-row-dateTime-value")).toHaveTextContent("next Saturday");
    expect(screen.getByTestId("context-row-location-value")).toHaveTextContent("Austin, TX");
  });

  it("renders one row per non-null categoryAttributes entry and omits null-value entries", async () => {
    await render(<ContextPanel {...baseProps()} />);

    expect(screen.getByTestId("context-row-guestCount-value")).toHaveTextContent("30");
    expect(screen.queryByTestId("context-row-theme")).toBeNull();
  });

  it("renders '{matchCount} matches found' for the given count", async () => {
    await render(<ContextPanel {...baseProps()} matchCount={5} />);

    expect(screen.getByTestId("context-match-count")).toHaveTextContent("5 matches found");
  });

  it("omits the currently-viewing block when the prop is undefined", async () => {
    await render(<ContextPanel {...baseProps()} />);

    expect(screen.queryByTestId("context-currently-viewing")).toBeNull();
  });

  it("renders the currently-viewing block with the given label when provided", async () => {
    await render(<ContextPanel {...baseProps()} currentlyViewing="Bounce Town" />);

    expect(screen.getByTestId("context-currently-viewing")).toHaveTextContent(
      "Currently viewing: Bounce Town",
    );
  });

  it("renders 'Chat' and calls onOpenChat on press when isChatOpen=false", async () => {
    const onOpenChat = jest.fn();
    await render(<ContextPanel {...baseProps()} isChatOpen={false} onOpenChat={onOpenChat} />);

    const button = screen.getByTestId("context-panel-button");
    expect(button).toHaveTextContent("Chat");

    await fireEvent.press(button);

    expect(onOpenChat).toHaveBeenCalledTimes(1);
  });

  it("renders 'Back to matches' and calls onBackToMatches on press when isChatOpen=true", async () => {
    const onBackToMatches = jest.fn();
    await render(
      <ContextPanel {...baseProps()} isChatOpen={true} onBackToMatches={onBackToMatches} />,
    );

    const button = screen.getByTestId("context-panel-button");
    expect(button).toHaveTextContent("Back to matches");

    await fireEvent.press(button);

    expect(onBackToMatches).toHaveBeenCalledTimes(1);
  });
});
