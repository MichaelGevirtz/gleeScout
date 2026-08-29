import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SimulatedSchema } from "../domain/evidence.js";
import { assembleSimulatedAnswers } from "./assembleSimulatedAnswers.js";

describe("assembleSimulatedAnswers", () => {
  it("pairs matching-length questions/answers in order", () => {
    const result = assembleSimulatedAnswers({
      questions: ["Are you available Saturday?", "What is your pricing?"],
      answers: ["Yes, we're available Saturday.", "$350 including setup."],
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(result).toEqual([
      {
        question: "Are you available Saturday?",
        answer: { value: "Yes, we're available Saturday.", generatedAt: "2026-01-01T00:00:00.000Z" },
      },
      {
        question: "What is your pricing?",
        answer: { value: "$350 including setup.", generatedAt: "2026-01-01T00:00:00.000Z" },
      },
    ]);
  });

  it("returns [] for empty questions/answers", () => {
    const result = assembleSimulatedAnswers({
      questions: [],
      answers: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(result).toEqual([]);
  });

  it("throws when lengths are mismatched", () => {
    expect(() =>
      assembleSimulatedAnswers({
        questions: ["Are you available Saturday?"],
        answers: [],
        generatedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("produces answers that validate against SimulatedSchema(z.string())", () => {
    const result = assembleSimulatedAnswers({
      questions: ["Are you available Saturday?"],
      answers: ["Yes, we're available Saturday."],
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    const schema = SimulatedSchema(z.string());
    for (const { answer } of result) {
      expect(schema.safeParse(answer).success).toBe(true);
    }
  });
});
