import { z } from "zod";
import { generateStructuredJson, type GeminiClient } from "./geminiClient.js";

export const ReviewAnalysisResultSchema = z.object({
  tags: z.array(
    z.object({
      tag: z.string(),
      excerpt: z.string().nullable(),
    })
  ),
});
export type ReviewAnalysisResult = z.infer<typeof ReviewAnalysisResultSchema>;

const SYSTEM_INSTRUCTION = `You are the review-analysis step of an event-planning assistant.
Given one already-scraped page's URL and markdown content, respond with JSON matching this shape:
{
  "tags": [
    { "tag": string, "excerpt": string | null }
  ]
}

Rules:
- Identify short, specific qualitative signals about the provider from reviews or reputation text on this page — the kind of thing a rating alone would miss, e.g. "good with toddlers", "frequently arrives late", "equipment is very clean", "specializes in large parties".
- Each tag must be concrete and specific. Do not produce generic praise or complaints like "great service" or "would recommend" — those carry no distinguishing signal.
- Do not restate information that a separate structured extraction step already captures: price, address, phone number, or the provider's list of services. This step is for qualitative/reputation signal only.
- Never fabricate a tag that isn't supported by the page text.
- For each tag, include a short supporting excerpt from the page text if one exists, or null if the signal is a fair summary but no single short quotable snippet supports it.
- If the page has no useful qualitative signal, return { "tags": [] }. An empty result is valid and preferred over invented signal.`;

function buildPrompt(url: string, markdown: string): string {
  return ["Page URL:", url, "", "Page content:", markdown].join("\n");
}

export type GenerateReviewAnalysisFn = (params: {
  schema: typeof ReviewAnalysisResultSchema;
  prompt: string;
  systemInstruction?: string;
  client?: GeminiClient;
}) => Promise<ReviewAnalysisResult>;

export interface AnalyzeReviewTextParams {
  url: string;
  markdown: string;
  /** Injected extraction call; defaults to Task 05's real generateStructuredJson. */
  generate?: GenerateReviewAnalysisFn;
}

export async function analyzeReviewText({
  url,
  markdown,
  generate = generateStructuredJson,
}: AnalyzeReviewTextParams): Promise<ReviewAnalysisResult> {
  return generate({
    schema: ReviewAnalysisResultSchema,
    prompt: buildPrompt(url, markdown),
    systemInstruction: SYSTEM_INSTRUCTION,
  });
}
