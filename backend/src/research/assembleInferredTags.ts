import type { Inferred, SourceType } from "../domain/evidence.js";
import type { ReviewAnalysisResult } from "../llm/reviewAnalysis.js";
import { hostnameMatches, stripWww } from "../shared/hostname.js";
import { isReputableDirectory } from "../shared/reviewDomains.js";

export function classifySourceType(url: string, providerUrl: string): SourceType {
  const hostname = new URL(url).hostname;
  const providerHostname = new URL(providerUrl).hostname;

  if (stripWww(hostname) === stripWww(providerHostname)) return "provider_website";
  if (hostnameMatches(hostname, "google.com")) return "google";
  if (hostnameMatches(hostname, "yelp.com")) return "yelp";
  // Independent event-vendor directories (task-98): enrichment's source-targeted
  // searches often land on one of these instead of Google/Yelp proper, and a
  // rating there is still not the provider talking about itself.
  if (isReputableDirectory(hostname)) return "directory";
  return "other";
}

export interface AssembleInferredTagsParams {
  url: string;
  providerUrl: string;
  analysis: ReviewAnalysisResult;
  retrievedAt: string;
}

export function assembleInferredTags({
  url,
  providerUrl,
  analysis,
  retrievedAt,
}: AssembleInferredTagsParams): Inferred<string>[] {
  const sourceType = classifySourceType(url, providerUrl);

  return analysis.tags.map(({ tag, excerpt }) => ({
    value: tag,
    evidenceSourceUrl: url,
    evidenceExcerpt: excerpt ?? undefined,
    sourceType,
    retrievedAt,
  }));
}
