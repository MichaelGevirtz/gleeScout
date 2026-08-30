import { describe, expect, it } from "vitest";
import {
  isIndependentReviewSource,
  isReputableDirectory,
  REPUTABLE_DIRECTORY_DOMAINS,
} from "./reviewDomains.js";

describe("isReputableDirectory", () => {
  it("accepts every allowlisted domain", () => {
    for (const domain of REPUTABLE_DIRECTORY_DOMAINS) {
      expect(isReputableDirectory(domain)).toBe(true);
    }
  });

  it("accepts a subdomain of an allowlisted domain", () => {
    expect(isReputableDirectory("www.gigsalad.com")).toBe(true);
  });

  it("rejects a lookalike hostname that merely ends with the same letters", () => {
    expect(isReputableDirectory("notgigsalad.com")).toBe(false);
  });

  it("rejects google and yelp, which are handled separately", () => {
    expect(isReputableDirectory("google.com")).toBe(false);
    expect(isReputableDirectory("yelp.com")).toBe(false);
  });

  it("rejects an arbitrary blog", () => {
    expect(isReputableDirectory("someblog.com")).toBe(false);
  });
});

describe("isIndependentReviewSource", () => {
  it("accepts google, yelp, and the directories", () => {
    expect(isIndependentReviewSource("www.google.com")).toBe(true);
    expect(isIndependentReviewSource("yelp.com")).toBe(true);
    expect(isIndependentReviewSource("www.thebash.com")).toBe(true);
  });

  it("rejects an arbitrary hostname", () => {
    expect(isIndependentReviewSource("bouncepalace.com")).toBe(false);
  });
});
