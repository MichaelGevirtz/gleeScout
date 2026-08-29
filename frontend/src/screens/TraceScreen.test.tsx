import { fireEvent, render, screen } from "@testing-library/react-native";
import { TraceScreen } from "./TraceScreen";
import type { TraceEvent } from "../domain/types";

function discoverEvent(): TraceEvent {
  return {
    step: "discover",
    summary: 'Searched for "bounce house rental" providers in Austin, TX',
    detail: { query: "bounce house rental in Austin, TX", candidatesFound: 8 },
    timestamp: "2026-08-29T00:00:00.000Z",
  };
}

function rankEvent(overrides: Partial<{ fitScore: number | null; matchGrade: string; explanation: string }> = {}): TraceEvent {
  return {
    step: "rank",
    summary: "Ranked providers",
    detail: {
      scores: [
        {
          provider: "Jump Around Rentals",
          score: 0.82,
          dimensionScores: {
            requirementMatch: 0.8,
            geoFit: 1,
            priceFit: 0.7,
            reputation: 0.9,
            evidenceQuality: null,
          },
          fitScore: 0.833,
          matchGrade: "wonderful",
          explanation: "Matches your requirements well.",
          ...overrides,
        },
      ],
    },
    timestamp: "2026-08-29T00:00:01.000Z",
  };
}

describe("TraceScreen", () => {
  it("renders the debug/transparency banner", async () => {
    await render(<TraceScreen events={[]} onBack={jest.fn()} />);

    expect(screen.getByTestId("trace-banner")).toHaveTextContent("Debug / Transparency View", {
      exact: false,
    });
  });

  it("renders an empty state when there are no events yet", async () => {
    await render(<TraceScreen events={[]} onBack={jest.fn()} />);

    expect(screen.getByTestId("trace-empty")).toHaveTextContent("No trace recorded yet.");
  });

  it("renders one numbered section per event, in order", async () => {
    await render(<TraceScreen events={[discoverEvent(), rankEvent()]} onBack={jest.fn()} />);

    expect(screen.getByTestId("trace-section-0")).toHaveTextContent("1. Provider discovery", {
      exact: false,
    });
    expect(screen.getByTestId("trace-section-1")).toHaveTextContent("2. Ranking", { exact: false });
  });

  it("renders the search query and candidate count for a discover step", async () => {
    await render(<TraceScreen events={[discoverEvent()]} onBack={jest.fn()} />);

    const section = screen.getByTestId("trace-section-0");
    expect(section).toHaveTextContent("bounce house rental in Austin, TX", { exact: false });
    expect(section).toHaveTextContent("Candidates found: 8", { exact: false });
  });

  it("renders each provider's label, score, and dimension scores for a rank step, with null shown as a dash", async () => {
    await render(<TraceScreen events={[rankEvent()]} onBack={jest.fn()} />);

    const scoreBlock = screen.getByTestId("trace-score-0");
    expect(scoreBlock).toHaveTextContent("Jump Around Rentals — score 0.82", { exact: false });
    expect(scoreBlock).toHaveTextContent("requirementMatch: 0.80", { exact: false });
    expect(scoreBlock).toHaveTextContent("evidenceQuality: —", { exact: false });
    expect(scoreBlock).not.toHaveTextContent("null", { exact: false });
  });

  it("renders the match grade, fitScore, and explanation for a rank step's score block", async () => {
    await render(<TraceScreen events={[rankEvent()]} onBack={jest.fn()} />);

    expect(screen.getByTestId("trace-score-0-grade")).toHaveTextContent("Wonderful match (fitScore: 0.83)");
    expect(screen.getByTestId("trace-score-0-explanation")).toHaveTextContent(
      "Matches your requirements well.",
    );
  });

  it("renders an em-dash for fitScore, never a fabricated number, when fitScore is null", async () => {
    await render(
      <TraceScreen
        events={[rankEvent({ fitScore: null, matchGrade: "insufficient_data" })]}
        onBack={jest.fn()}
      />,
    );

    const gradeLine = screen.getByTestId("trace-score-0-grade");
    expect(gradeLine).toHaveTextContent(/Not enough information to assess fit/);
    expect(gradeLine).toHaveTextContent(/fitScore: —/);
  });

  it("renders each phrased question for a prepareQuestions step", async () => {
    const event: TraceEvent = {
      step: "prepareQuestions",
      summary: "Identified 2 questions",
      detail: { questions: ["Are you available Saturday?", "Does the price include setup?"] },
      timestamp: "2026-08-29T00:00:00.000Z",
    };

    await render(<TraceScreen events={[event]} onBack={jest.fn()} />);

    expect(screen.getByTestId("trace-question-0")).toHaveTextContent("Are you available Saturday?", {
      exact: false,
    });
    expect(screen.getByTestId("trace-question-1")).toHaveTextContent(
      "Does the price include setup?",
      { exact: false }
    );
  });

  it("renders a clear message when a prepareQuestions step has zero questions", async () => {
    const event: TraceEvent = {
      step: "prepareQuestions",
      summary: "Identified 0 questions",
      detail: { questions: [] },
      timestamp: "2026-08-29T00:00:00.000Z",
    };

    await render(<TraceScreen events={[event]} onBack={jest.fn()} />);

    expect(screen.getByTestId("trace-section-0")).toHaveTextContent("No further questions needed.", {
      exact: false,
    });
  });

  it("renders only the answer count for a simulateAnswers step, never answer text", async () => {
    const event: TraceEvent = {
      step: "simulateAnswers",
      summary: "Generated 2 simulated answers (not a real provider response)",
      detail: { answerCount: 2 },
      timestamp: "2026-08-29T00:00:00.000Z",
    };

    await render(<TraceScreen events={[event]} onBack={jest.fn()} />);

    const section = screen.getByTestId("trace-section-0");
    expect(section).toHaveTextContent("Simulated answers generated: 2", { exact: false });
  });

  it("calls onBack when the back control is pressed", async () => {
    const onBack = jest.fn();
    await render(<TraceScreen events={[]} onBack={onBack} />);

    await fireEvent.press(screen.getByTestId("trace-back-button"));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
