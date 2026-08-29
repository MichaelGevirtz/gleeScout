import { z } from "zod";

export function FactSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema,
    source: z.string(),
    sourceUrl: z.string().url(),
    retrievedAt: z.string().datetime(),
  });
}

export type Fact<T> = {
  value: T;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
};

export const SourceTypeSchema = z.enum([
  "google",
  "yelp",
  "provider_website",
  "directory",
  "other",
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export function InferredSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema,
    evidenceSourceUrl: z.string().url(),
    evidenceExcerpt: z.string().optional(),
    sourceType: SourceTypeSchema,
    retrievedAt: z.string().datetime(),
  });
}

export type Inferred<T> = {
  value: T;
  evidenceSourceUrl: string;
  evidenceExcerpt?: string;
  sourceType: SourceType;
  retrievedAt: string;
};

export function SimulatedSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema,
    generatedAt: z.string().datetime(),
  });
}

export type Simulated<T> = {
  value: T;
  generatedAt: string;
};
