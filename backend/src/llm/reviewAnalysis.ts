import { z } from "zod";
import { generateStructuredJson, type GeminiClient } from "./geminiClient.js";

export const ReviewAnalysisResultSchema = z.object({
  tags: z.array(
    z.object({
      tag: z.string(),
      excerpt: z.string().nullable(),
    })
  ),
  rating: z.number().min(1).max(5).nullable(),
  reviewCount: z.number().int().nonnegative().nullable(),
  /** Which supplied page the rating/reviewCount pair was read from. */
  ratingSourceUrl: z.string().nullable(),
});
export type ReviewAnalysisResult = z.infer<typeof ReviewAnalysisResultSchema>;

export interface ReviewAnalysisPage {
  url: string;
  markdown: string;
}

const SYSTEM_INSTRUCTION = `You are the review-analysis step of an event-planning assistant.
Given one or more already-scraped pages (each with its URL and markdown content), respond with JSON matching this shape:
{
  "tags": [
    { "tag": string, "excerpt": string | null }
  ],
  "rating": number | null,
  "reviewCount": number | null,
  "ratingSourceUrl": string | null
}

Rules for "tags":
- Identify short, specific qualitative signals about the provider from reviews or reputation text on these pages — the kind of thing a rating alone would miss, e.g. "good with toddlers", "frequently arrives late", "equipment is very clean", "specializes in large parties".
- Each tag must be concrete and specific. Do not produce generic praise or complaints like "great service" or "would recommend" — those carry no distinguishing signal.
- Do not restate information that a separate structured extraction step already captures: price, address, phone number, or the provider's list of services. This step is for qualitative/reputation signal only.
- Never fabricate a tag that isn't supported by the page text.
- For each tag, include a short supporting excerpt from the page text if one exists, or null if the signal is a fair summary but no single short quotable snippet supports it.
- If the pages have no useful qualitative signal, return an empty "tags" array. An empty result is valid and preferred over invented signal.

Rules for "rating" / "reviewCount" / "ratingSourceUrl":
- Return "rating" and "reviewCount" ONLY when one of the supplied pages clearly states an overall star rating for THIS provider.
- Never estimate a rating, never average ratings across pages, and never infer one from general knowledge. Only report a number the page itself states.
- "rating" and "reviewCount" must come from the SAME page, and "ratingSourceUrl" must be exactly that page's URL as it was supplied to you — copied character for character, not reconstructed or shortened.
- If a rating appears on one page and a review count only on a different page, return null for all three.
- If the rating is unclear, absent, or belongs to a different business, return null for all three. An empty result is preferred over a guess.`;

function buildPrompt(pages: ReviewAnalysisPage[]): string {
  return pages
    .map((page) => ["Page URL:", page.url, "", "Page content:", page.markdown].join("\n"))
    .join("\n\n---\n\n");
}

export type GenerateReviewAnalysisFn = (params: {
  schema: typeof ReviewAnalysisResultSchema;
  prompt: string;
  systemInstruction?: string;
  client?: GeminiClient;
}) => Promise<ReviewAnalysisResult>;

export interface AnalyzeReviewTextParams {
  /**
   * All pages gathered for one provider, analyzed in a single call. Kept to one
   * call per provider on purpose: Gemini's free tier caps `generateContent` at
   * 5 requests/minute (D2b), so the dual-source lookup added in task-98 doubles
   * Firecrawl calls without changing the Gemini call budget.
   */
  pages: ReviewAnalysisPage[];
  /** Injected extraction call; defaults to Task 05's real generateStructuredJson. */
  generate?: GenerateReviewAnalysisFn;
}

export async function analyzeReviewText({
  pages,
  generate = generateStructuredJson,
}: AnalyzeReviewTextParams): Promise<ReviewAnalysisResult> {
  return generate({
    schema: ReviewAnalysisResultSchema,
    prompt: buildPrompt(pages),
    systemInstruction: SYSTEM_INSTRUCTION,
  });
}
