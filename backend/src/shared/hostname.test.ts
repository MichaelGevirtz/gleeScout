import { describe, expect, it } from "vitest";
import { hostnameMatches, stripWww } from "./hostname.js";

describe("stripWww", () => {
  it("strips a leading www. prefix", () => {
    expect(stripWww("www.bouncepalace.com")).toBe("bouncepalace.com");
  });

  it("leaves a hostname without a www. prefix unchanged", () => {
    expect(stripWww("bouncepalace.com")).toBe("bouncepalace.com");
  });

  it("does not strip www in the middle of a hostname", () => {
    expect(stripWww("shop.www.bouncepalace.com")).toBe("shop.www.bouncepalace.com");
  });
});

describe("hostnameMatches", () => {
  it("matches a bare domain exactly", () => {
    expect(hostnameMatches("google.com", "google.com")).toBe(true);
  });

  it("matches a subdomain of the domain", () => {
    expect(hostnameMatches("maps.google.com", "google.com")).toBe(true);
  });

  it("does not match a lookalike hostname", () => {
    expect(hostnameMatches("notgoogle.com", "google.com")).toBe(false);
    expect(hostnameMatches("mygoogle.com", "google.com")).toBe(false);
  });

  it("does not match an unrelated hostname", () => {
    expect(hostnameMatches("yelp.com", "google.com")).toBe(false);
  });
});
