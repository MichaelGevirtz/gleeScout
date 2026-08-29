import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SimulatedQAScreen } from "./SimulatedQAScreen";
import type { SimulatedAnswer } from "../domain/types";

const FORBIDDEN_PHRASES = ["we asked them", "they said", "confirmed with provider"];

function makeAnswers(): SimulatedAnswer[] {
  return [
    {
      question: "Are you available on the requested date?",
      answer: {
        value: "Looks likely open based on their listed availability — not a confirmed booking.",
        generatedAt: "2026-08-29T10:00:00.000Z",
      },
    },
    {
      question: "What is the typical price range?",
      answer: {
        value: "Estimated around $500-800 based on similar listings — not a quoted price.",
        generatedAt: "2026-08-29T10:00:01.000Z",
      },
    },
  ];
}

describe("SimulatedQAScreen", () => {
  describe("phase: loading", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("renders the cosmetic two-step loading animation", async () => {
      await render(<SimulatedQAScreen phase="loading" />);

      expect(screen.getByTestId("qa-loading")).toBeTruthy();
      expect(screen.getByTestId("qa-loading-step-questions")).toBeTruthy();
      expect(screen.getByTestId("qa-loading-step-answers")).toBeTruthy();
      expect(screen.getByText("Preparing questions…")).toBeTruthy();
      expect(screen.getByText("Preparing simulated answers…")).toBeTruthy();
    });

    it("cycles the active step over time via its internal timer", async () => {
      await render(<SimulatedQAScreen phase="loading" />);

      expect(screen.getByTestId("qa-loading-step-questions").props.accessibilityState).toEqual({
        selected: true,
      });
      expect(screen.getByTestId("qa-loading-step-answers").props.accessibilityState).toEqual({
        selected: false,
      });

      await act(async () => {
        jest.advanceTimersByTime(1200);
      });

      expect(screen.getByTestId("qa-loading-step-questions").props.accessibilityState).toEqual({
        selected: false,
      });
      expect(screen.getByTestId("qa-loading-step-answers").props.accessibilityState).toEqual({
        selected: true,
      });
    });

    it("clears its internal timer on unmount (no leaked interval)", async () => {
      const clearIntervalSpy = jest.spyOn(global, "clearInterval");

      const { unmount } = await render(<SimulatedQAScreen phase="loading" />);
      await act(async () => {
        unmount();
      });

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it("does not render the selected-provider header (no provider context yet)", async () => {
      const { unmount } = await render(<SimulatedQAScreen phase="loading" />);

      expect(screen.queryByTestId("selected-provider-header")).toBeNull();

      await act(async () => {
        unmount();
      });
    });
  });

  describe("phase: results", () => {
    it("renders one card per answers[] entry, each carrying the SIMULATED badge", async () => {
      const answers = makeAnswers();
      await render(
        <SimulatedQAScreen phase="results" providerName="Acme Catering" answers={answers} onBack={() => {}} />
      );

      expect(screen.getByTestId("qa-card-0")).toBeTruthy();
      expect(screen.getByTestId("qa-card-1")).toBeTruthy();
      expect(screen.getByTestId("qa-badge-0")).toHaveTextContent("SIMULATED · NOT CONFIRMED");
      expect(screen.getByTestId("qa-badge-1")).toHaveTextContent("SIMULATED · NOT CONFIRMED");
    });

    it("renders the persistent banner exactly once, with the provider name interpolated", async () => {
      const answers = makeAnswers();
      await render(
        <SimulatedQAScreen phase="results" providerName="Acme Catering" answers={answers} onBack={() => {}} />
      );

      const banners = screen.getAllByTestId("qa-banner");
      expect(banners).toHaveLength(1);
      expect(banners[0]).toHaveTextContent(
        "SIMULATED — NOT CONFIRMED WITH THE PROVIDER. We have not actually contacted Acme Catering. Every answer below is an AI estimate; confirm directly with them before booking or paying anything."
      );
    });

    it("renders question/answer text verbatim, unmodified from props", async () => {
      const answers = makeAnswers();
      await render(
        <SimulatedQAScreen phase="results" providerName="Acme Catering" answers={answers} onBack={() => {}} />
      );

      expect(screen.getByTestId("qa-question-0")).toHaveTextContent(answers[0].question);
      expect(screen.getByTestId("qa-answer-0")).toHaveTextContent(answers[0].answer.value);
      expect(screen.getByTestId("qa-question-1")).toHaveTextContent(answers[1].question);
      expect(screen.getByTestId("qa-answer-1")).toHaveTextContent(answers[1].answer.value);
    });

    it("calls onBack when Back to your matches is tapped", async () => {
      const onBack = jest.fn();
      const answers = makeAnswers();
      await render(
        <SimulatedQAScreen phase="results" providerName="Acme Catering" answers={answers} onBack={onBack} />
      );

      await fireEvent.press(screen.getByTestId("qa-back"));

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("never uses forbidden real-contact phrasing in the badge or banner text", async () => {
      const answers = makeAnswers();
      await render(
        <SimulatedQAScreen phase="results" providerName="Acme Catering" answers={answers} onBack={() => {}} />
      );

      const bannerText = screen.getByTestId("qa-banner").props.children;
      const bannerString = Array.isArray(bannerText) ? bannerText.join("") : String(bannerText);
      const badgeText = screen.getByTestId("qa-badge-0").props.children;
      const badgeString = Array.isArray(badgeText) ? badgeText.join("") : String(badgeText);

      for (const phrase of FORBIDDEN_PHRASES) {
        expect(bannerString.toLowerCase()).not.toContain(phrase);
        expect(badgeString.toLowerCase()).not.toContain(phrase);
      }
    });

    it("renders the selected-provider header with the given provider name", async () => {
      const answers = makeAnswers();
      await render(
        <SimulatedQAScreen phase="results" providerName="Acme Catering" answers={answers} onBack={() => {}} />
      );

      expect(screen.getByTestId("selected-provider-header")).toBeTruthy();
      expect(screen.getByTestId("selected-provider-header-name").props.children).toBe(
        "Acme Catering",
      );
    });

    it("renders zero cards for an empty answers array without crashing", async () => {
      await render(
        <SimulatedQAScreen phase="results" providerName="Acme Catering" answers={[]} onBack={() => {}} />
      );

      expect(screen.queryByTestId("qa-card-0")).toBeNull();
      expect(screen.getByTestId("qa-banner")).toBeTruthy();
    });
  });
});
