import type {
  ConversationState,
  ProviderCandidate,
  ProviderScore,
  SimulatedAnswer,
  TraceEvent,
} from "../domain/types";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // fall through to generic message
  }
  return `Request failed with status ${response.status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response));
  }

  return (await response.json()) as T;
}

export function createConversation(): Promise<{ sessionId: string; state: ConversationState }> {
  return request("/conversation", { method: "POST" });
}

export function getConversation(sessionId: string): Promise<{ state: ConversationState }> {
  return request(`/conversation/${sessionId}`, { method: "GET" });
}

export function sendMessage(
  sessionId: string,
  message: string,
): Promise<{ state: ConversationState }> {
  return request(`/conversation/${sessionId}/message`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function fetchProviders(sessionId: string): Promise<{ providers: ProviderScore[] }> {
  return request(`/conversation/${sessionId}/providers`, { method: "POST" });
}

export function selectProvider(
  sessionId: string,
  candidate: ProviderCandidate,
): Promise<{ answers: SimulatedAnswer[] }> {
  return request(`/conversation/${sessionId}/providers/select`, {
    method: "POST",
    body: JSON.stringify({ candidate }),
  });
}

export function fetchTrace(sessionId: string): Promise<{ events: TraceEvent[] }> {
  return request(`/conversation/${sessionId}/trace`, { method: "GET" });
}
