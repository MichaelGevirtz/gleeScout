import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  GeminiConfigError,
  GeminiParseError,
  GeminiValidationError,
  generateStructuredJson,
  type GeminiClient,
} from "./geminiClient.js";

const testSchema = z.object({
  name: z.string(),
  count: z.number(),
});

function fakeClient(responseText: string | undefined): GeminiClient {
  return {
    models: {
      generateContent: async () => ({ text: responseText }),
    },
  };
}

describe("generateStructuredJson", () => {
  it("throws a config error when GEMINI_API_KEY is missing and no client is injected", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      await expect(
        generateStructuredJson({ schema: testSchema, prompt: "hello" })
      ).rejects.toBeInstanceOf(GeminiConfigError);
    } finally {
      if (originalKey !== undefined) {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  it("returns the parsed, typed object for valid JSON matching the schema", async () => {
    const client = fakeClient('{"name":"bounce house","count":2}');

    const result = await generateStructuredJson({
      schema: testSchema,
      prompt: "hello",
      client,
    });

    expect(result).toEqual({ name: "bounce house", count: 2 });
  });

  it("throws a validation error when JSON fails schema validation", async () => {
    const client = fakeClient('{"name":"bounce house"}');

    await expect(
      generateStructuredJson({ schema: testSchema, prompt: "hello", client })
    ).rejects.toBeInstanceOf(GeminiValidationError);
  });

  it("throws a parse error when the response text is not valid JSON", async () => {
    const client = fakeClient("not json");

    await expect(
      generateStructuredJson({ schema: testSchema, prompt: "hello", client })
    ).rejects.toBeInstanceOf(GeminiParseError);
  });

  it("throws a parse error when the response has no text content", async () => {
    const client = fakeClient(undefined);

    await expect(
      generateStructuredJson({ schema: testSchema, prompt: "hello", client })
    ).rejects.toBeInstanceOf(GeminiParseError);
  });
});
