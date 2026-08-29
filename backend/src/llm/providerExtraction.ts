import { z } from "zod";
import { generateStructuredJson, type GeminiClient } from "./geminiClient.js";

export const ProviderExtractionResultSchema = z.object({
  name: z.string().nullable(),
  location: z.string().nullable(),
  servicesOffered: z.array(z.string()).nullable(),
  pricing: z.string().nullable(),
  availability: z.string().nullable(),
  rating: z.number().nullable(),
  reviewCount: z.number().nullable(),
  photos: z.array(z.string()).nullable(),
  policies: z.string().nullable(),
  contactMethod: z.string().nullable(),
});
export type ProviderExtractionResult = z.infer<typeof ProviderExtractionResultSchema>;

const SYSTEM_INSTRUCTION = `You are the provider-fact-extraction step of an event-planning assistant.
Given one already-scraped page's URL and markdown content, respond with JSON matching this shape:
{
  "name": string | null,
  "location": string | null,
  "servicesOffered": string[] | null,
  "pricing": string | null,
  "availability": string | null,
  "rating": number | null,
  "reviewCount": number | null,
  "photos": string[] | null,
  "policies": string | null,
  "contactMethod": string | null
}

Rules:
- Every field is independently optional — a field being present in this schema means "useful if found," never "must be produced."
- Only report a field if this page clearly states it; use null for anything not present, unclear, or inferred. Do not guess, estimate, or use general knowledge about this business.
- "name": the provider's business name.
- "location": the provider's location or service area.
- "servicesOffered": the specific services this provider offers.
- "pricing": approximate pricing information as stated on the page.
- "availability": availability information as stated on the page.
- "rating": the provider's rating, as a number, if the page states one.
- "reviewCount": the number of reviews, if the page states one.
- "photos": URLs of relevant photos found on the page.
- "policies": important policies (cancellation, deposit, etc.) as stated on the page.
- "contactMethod": how to contact the provider (phone, email, form, etc.).`;

function buildPrompt(url: string, markdown: string): string {
  return ["Page URL:", url, "", "Page content:", markdown].join("\n");
}

export type GenerateProviderExtractionFn = (params: {
  schema: typeof ProviderExtractionResultSchema;
  prompt: string;
  systemInstruction?: string;
  client?: GeminiClient;
}) => Promise<ProviderExtractionResult>;

export interface ExtractProviderFactsParams {
  url: string;
  markdown: string;
  /** Injected extraction call; defaults to Task 05's real generateStructuredJson. */
  generate?: GenerateProviderExtractionFn;
}

export async function extractProviderFacts({
  url,
  markdown,
  generate = generateStructuredJson,
}: ExtractProviderFactsParams): Promise<ProviderExtractionResult> {
  return generate({
    schema: ProviderExtractionResultSchema,
    prompt: buildPrompt(url, markdown),
    systemInstruction: SYSTEM_INSTRUCTION,
  });
}
