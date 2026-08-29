import { z } from "zod";

export const TraceEventSchema = z.object({
  step: z.string(),
  summary: z.string(),
  detail: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().datetime(),
  durationMs: z.number().nonnegative().optional(),
});

export type TraceEvent = z.infer<typeof TraceEventSchema>;
