import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";

const DEFAULT_MODEL = "gemini-3.6-flash";

/**
 * Minimal shape this module needs from the Gemini SDK client. Kept
 * separate from the SDK's own types so callers of
 * `generateStructuredJson` never need to import from `@google/genai`.
 */
export interface GeminiClient {
  models: {
    generateContent(params: {
      model: string;
      contents: string;
      config: {
        systemInstruction?: string;
        responseMimeType: string;
      };
    }): Promise<{ text?: string }>;
  };
}

export class GeminiConfigError extends Error {}
export class GeminiParseError extends Error {}
export class GeminiValidationError extends Error {}

function createDefaultClient(): GeminiClient {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiConfigError(
      "GEMINI_API_KEY is not set. Set it in the environment before calling the Gemini client."
    );
  }
  return new GoogleGenAI({ apiKey });
}

export interface GenerateStructuredJsonParams<T> {
  schema: ZodType<T>;
  prompt: string;
  systemInstruction?: string;
  /** Injected SDK client; defaults to a real client built from GEMINI_API_KEY. */
  client?: GeminiClient;
}

export async function generateStructuredJson<T>({
  schema,
  prompt,
  systemInstruction,
  client,
}: GenerateStructuredJsonParams<T>): Promise<T> {
  const activeClient = client ?? createDefaultClient();
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;

  const response = await activeClient.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (text === undefined) {
    throw new GeminiParseError("Gemini response contained no text content.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new GeminiParseError(
      `Gemini response was not valid JSON: ${(error as Error).message}`
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new GeminiValidationError(
      `Gemini response failed schema validation: ${result.error.message}`
    );
  }

  return result.data;
}
