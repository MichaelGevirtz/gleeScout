import {
  ApiError,
  createConversation,
  fetchProviders,
  getConversation,
  selectProvider,
  sendMessage,
} from "./client";
import type { ConversationState, ProviderCandidate } from "../domain/types";

function mockFetchOnce(status: number, body: unknown, ok = status >= 200 && status < 300) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
  });
}

const state: ConversationState = {
  sessionId: "s1",
  phase: "gathering",
  serviceCategory: null,
  coreAttributes: {},
  categoryAttributes: {},
  messages: [],
};

const candidate: ProviderCandidate = {
  url: "https://example.com",
  fields: {},
};

beforeEach(() => {
  global.fetch = jest.fn();
});

describe("createConversation", () => {
  it("returns sessionId + state on success", async () => {
    mockFetchOnce(201, { sessionId: "s1", state });
    await expect(createConversation()).resolves.toEqual({ sessionId: "s1", state });
  });

  it("throws ApiError on failure", async () => {
    mockFetchOnce(500, { error: "boom" });
    await expect(createConversation()).rejects.toMatchObject({ status: 500, message: "boom" });
  });
});

describe("getConversation", () => {
  it("returns state on success", async () => {
    mockFetchOnce(200, { state });
    await expect(getConversation("s1")).resolves.toEqual({ state });
  });

  it("throws ApiError with status 404 on failure", async () => {
    mockFetchOnce(404, { error: "Session not found" });
    await expect(getConversation("s1")).rejects.toBeInstanceOf(ApiError);
    mockFetchOnce(404, { error: "Session not found" });
    await expect(getConversation("s1")).rejects.toMatchObject({ status: 404 });
  });
});

describe("sendMessage", () => {
  it("returns state on success", async () => {
    mockFetchOnce(200, { state });
    await expect(sendMessage("s1", "hello")).resolves.toEqual({ state });
  });

  it("throws ApiError on failure", async () => {
    mockFetchOnce(502, { error: "Upstream language model call failed." });
    await expect(sendMessage("s1", "hello")).rejects.toMatchObject({ status: 502 });
  });
});

describe("fetchProviders", () => {
  it("returns providers on success", async () => {
    mockFetchOnce(200, { providers: [] });
    await expect(fetchProviders("s1")).resolves.toEqual({ providers: [] });
  });

  it("throws ApiError with status 409 when not ready", async () => {
    mockFetchOnce(409, { error: "Conversation is not ready for search yet." });
    await expect(fetchProviders("s1")).rejects.toMatchObject({ status: 409 });
  });
});

describe("selectProvider", () => {
  it("returns answers on success", async () => {
    mockFetchOnce(200, { answers: [] });
    await expect(selectProvider("s1", candidate)).resolves.toEqual({ answers: [] });
  });

  it("throws ApiError on failure", async () => {
    mockFetchOnce(400, { error: "Invalid request body" });
    await expect(selectProvider("s1", candidate)).rejects.toMatchObject({ status: 400 });
  });
});

describe("error body fallback", () => {
  it("still throws a sensible ApiError when the error body isn't JSON", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });
    await expect(getConversation("s1")).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining("500"),
    });
  });
});
