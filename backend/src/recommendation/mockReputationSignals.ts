// Simulates two review-platform lookups — a Google-like source and a
// Yelp-like source — with fabricated, deterministic data. No real API
// calls are made to either platform; nothing here is a factual rating.

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function generateMockReputation(seed: string): { rating: number; reviewCount: number } {
  const ratingHash = hashString(`${seed}:rating`);
  const reviewCountHash = hashString(`${seed}:reviewCount`);
  const rating = 1 + (ratingHash % 41) / 10;
  const reviewCount = 10 + (reviewCountHash % 991);
  return { rating, reviewCount };
}

export function computeMockReputation(
  url: string
): { reputationRating: number; reputationReviewCount: number } {
  const googleMock = generateMockReputation(`${url}:google`);
  const yelpMock = generateMockReputation(`${url}:yelp`);
  const reputationRating = Math.round(((googleMock.rating + yelpMock.rating) / 2) * 10) / 10;
  const reputationReviewCount = Math.round((googleMock.reviewCount + yelpMock.reviewCount) / 2);
  return { reputationRating, reputationReviewCount };
}
