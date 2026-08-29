import type { Simulated } from "../domain/evidence.js";

export interface AssembleSimulatedAnswersParams {
  questions: string[];
  answers: string[];
  generatedAt: string;
}

export function assembleSimulatedAnswers({
  questions,
  answers,
  generatedAt,
}: AssembleSimulatedAnswersParams): { question: string; answer: Simulated<string> }[] {
  if (questions.length !== answers.length) {
    throw new Error(
      `assembleSimulatedAnswers: questions.length (${questions.length}) !== answers.length (${answers.length})`,
    );
  }

  return questions.map((question, i) => ({
    question,
    answer: { value: answers[i], generatedAt },
  }));
}
