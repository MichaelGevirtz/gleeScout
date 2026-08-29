import { z } from "zod";
import { FactSchema, InferredSchema } from "./evidence.js";

export const DiscoveredResultSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
});
export type DiscoveredResult = z.infer<typeof DiscoveredResultSchema>;

export const ProviderCandidateFieldsSchema = z.object({
  name: FactSchema(z.string()).optional(),
  location: FactSchema(z.string()).optional(),
  servicesOffered: FactSchema(z.array(z.string())).optional(),
  pricing: FactSchema(z.string()).optional(),
  availability: FactSchema(z.string()).optional(),
  rating: FactSchema(z.number()).optional(),
  reviewCount: FactSchema(z.number()).optional(),
  photos: FactSchema(z.array(z.string().url())).optional(),
  policies: FactSchema(z.string()).optional(),
  contactMethod: FactSchema(z.string()).optional(),
});
export type ProviderCandidateFields = z.infer<typeof ProviderCandidateFieldsSchema>;

export const ProviderCandidateSchema = z.object({
  url: z.string().url(),
  fields: ProviderCandidateFieldsSchema,
  inferred: z.array(InferredSchema(z.string())).optional(),
  reputationRating: z.number().min(1).max(5).optional(),
  reputationReviewCount: z.number().int().min(10).max(1000).optional(),
});
export type ProviderCandidate = z.infer<typeof ProviderCandidateSchema>;
