import { describe, expect, it, vi } from "vitest";
import {
  FirecrawlConfigError,
  FirecrawlRateLimitError,
  searchProviderPages,
  type FirecrawlSearchClient,
} from "./firecrawlProvider.js";

describe("searchProviderPages", () => {
  it("maps N results with scraped content into N SearchedPage objects", async () => {
    const client: FirecrawlSearchClient = {
      search: vi.fn().mockResolvedValue({
        results: [
          {
            url: "https://example.com/a",
            title: "Provider A",
            description: "desc A",
            markdown: "# Provider A\nContent here.",
          },
          {
            url: "https://example.com/b",
            title: "Provider B",
            markdown: "# Provider B",
          },
        ],
      }),
    };

    const pages = await searchProviderPages({
      query: "wedding photographer in Tel Aviv",
      limit: 8,
      client,
    });

    expect(pages).toEqual([
      {
        result: {
          url: "https://example.com/a",
          title: "Provider A",
          description: "desc A",
        },
        markdown: "# Provider A\nContent here.",
      },
      {
        result: {
          url: "https://example.com/b",
          title: "Provider B",
          description: undefined,
        },
        markdown: "# Provider B",
      },
    ]);
  });

  it("maps a result with no scraped content to markdown: null, not an exception", async () => {
    const client: FirecrawlSearchClient = {
      search: vi.fn().mockResolvedValue({
        results: [
          { url: "https://example.com/a", title: "Provider A" },
        ],
      }),
    };

    const pages = await searchProviderPages({
      query: "wedding photographer in Tel Aviv",
      limit: 8,
      client,
    });

    expect(pages).toHaveLength(1);
    expect(pages[0].markdown).toBeNull();
  });

  it("throws FirecrawlConfigError when FIRECRAWL_API_KEY is unset and no client is injected", async () => {
    const original = process.env.FIRECRAWL_API_KEY;
    delete process.env.FIRECRAWL_API_KEY;

    await expect(
      searchProviderPages({ query: "bounce house in Austin", limit: 8 })
    ).rejects.toBeInstanceOf(FirecrawlConfigError);

    if (original !== undefined) process.env.FIRECRAWL_API_KEY = original;
  });

  it("propagates a whole-request failure instead of swallowing it", async () => {
    const client: FirecrawlSearchClient = {
      search: vi.fn().mockRejectedValue(new Error("Firecrawl API is down")),
    };

    await expect(
      searchProviderPages({
        query: "taco truck in Austin",
        limit: 8,
        client,
      })
    ).rejects.toThrow("Firecrawl API is down");
  });

  it("throws a FirecrawlRateLimitError when the client rejects with a status-429 error", async () => {
    const rateLimitError = Object.assign(new Error("Rate limit exceeded"), { status: 429 });
    const client: FirecrawlSearchClient = {
      search: vi.fn().mockRejectedValue(rateLimitError),
    };

    await expect(
      searchProviderPages({ query: "bounce house in Austin", limit: 8, client })
    ).rejects.toBeInstanceOf(FirecrawlRateLimitError);
  });

  it("propagates a non-429-status failure unchanged, not as a rate-limit error", async () => {
    const serverError = Object.assign(new Error("Internal error"), { status: 500 });
    const client: FirecrawlSearchClient = {
      search: vi.fn().mockRejectedValue(serverError),
    };

    await expect(
      searchProviderPages({ query: "bounce house in Austin", limit: 8, client })
    ).rejects.not.toBeInstanceOf(FirecrawlRateLimitError);
  });

  it("passes limit through to the underlying client call unchanged", async () => {
    const search = vi.fn().mockResolvedValue({ results: [] });
    const client: FirecrawlSearchClient = { search };

    await searchProviderPages({ query: "bartender in Miami", limit: 8, client });

    expect(search).toHaveBeenCalledWith({
      query: "bartender in Miami",
      limit: 8,
    });
  });
});
