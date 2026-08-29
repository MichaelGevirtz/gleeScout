import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { createSession, getSession, updateSession } from "./store/sessionStore.js";
import { orchestrateMessage, type OrchestrateMessageParams } from "./conversation/orchestrateMessage.js";
import { runSerialized } from "./conversation/sessionQueue.js";
import { GeminiConfigError, GeminiParseError, GeminiValidationError } from "./llm/geminiClient.js";
import { FirecrawlConfigError } from "./research/firecrawlProvider.js";
import {
  generateProviderList,
  type GenerateProviderListParams,
} from "./recommendation/generateProviderList.js";
import { selectProvider, type SelectProviderParams } from "./recommendation/selectProvider.js";
import { ProviderCandidateSchema } from "./domain/provider.js";

const MessageBodySchema = z.object({
  message: z.string().min(1),
});

const SelectProviderBodySchema = z.object({
  candidate: ProviderCandidateSchema,
});

export type OrchestrateMessageFn = (params: OrchestrateMessageParams) => ReturnType<typeof orchestrateMessage>;

export type GenerateProviderListFn = (
  params: GenerateProviderListParams
) => ReturnType<typeof generateProviderList>;

export type SelectProviderFn = (params: SelectProviderParams) => ReturnType<typeof selectProvider>;

export interface BuildServerDeps {
  orchestrate?: OrchestrateMessageFn;
  generateList?: GenerateProviderListFn;
  selectProvider?: SelectProviderFn;
}

export function buildServer(deps: BuildServerDeps = {}): FastifyInstance {
  const orchestrate = deps.orchestrate ?? orchestrateMessage;
  const generateList = deps.generateList ?? generateProviderList;
  const select = deps.selectProvider ?? selectProvider;
  const app = Fastify({ logger: true });

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.post("/conversation", async (_request, reply) => {
    const state = createSession();
    reply.code(201);
    return { sessionId: state.sessionId, state };
  });

  app.get<{ Params: { id: string } }>("/conversation/:id", async (request, reply) => {
    const state = getSession(request.params.id);
    if (!state) {
      reply.code(404);
      return { error: "Session not found" };
    }
    return { state };
  });

  app.post<{ Params: { id: string } }>("/conversation/:id/message", async (request, reply) => {
    const parsedBody = MessageBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      reply.code(400);
      return { error: "Invalid request body: 'message' must be a non-empty string." };
    }

    const sessionId = request.params.id;

    try {
      // The session is read fresh *inside* the serialized closure — not captured
      // beforehand — so a request queued behind another sees that request's
      // already-persisted update, not a stale snapshot (D11).
      const nextState = await runSerialized(sessionId, async () => {
        const state = getSession(sessionId);
        if (!state) {
          return null;
        }
        const updated = await orchestrate({ state, message: parsedBody.data.message });
        updateSession(sessionId, updated);
        return updated;
      });

      if (!nextState) {
        reply.code(404);
        return { error: "Session not found" };
      }
      return { state: nextState };
    } catch (error) {
      if (
        error instanceof GeminiConfigError ||
        error instanceof GeminiParseError ||
        error instanceof GeminiValidationError
      ) {
        app.log.error(error);
        reply.code(502);
        return { error: "Upstream language model call failed." };
      }
      app.log.error(error);
      reply.code(500);
      return { error: "Unexpected server error." };
    }
  });

  app.post<{ Params: { id: string } }>("/conversation/:id/providers", async (request, reply) => {
    const state = getSession(request.params.id);
    if (!state) {
      reply.code(404);
      return { error: "Session not found" };
    }
    if (state.phase !== "ready_for_search") {
      reply.code(409);
      return { error: "Conversation is not ready for search yet." };
    }

    try {
      const providers = await generateList({ state });
      return { providers };
    } catch (error) {
      if (
        error instanceof GeminiConfigError ||
        error instanceof GeminiParseError ||
        error instanceof GeminiValidationError ||
        error instanceof FirecrawlConfigError
      ) {
        app.log.error(error);
        reply.code(502);
        return { error: "Upstream provider-research call failed." };
      }
      app.log.error(error);
      reply.code(500);
      return { error: "Unexpected server error." };
    }
  });

  // Structural validation only (ProviderCandidateSchema shape) — this does
  // NOT verify the candidate actually came from this session's own
  // /providers response, or that its FACT-tagged fields are genuine. There
  // is no auth/multi-tenant boundary in this prototype, so a client
  // resending what the server just gave it is trusted, not re-verified
  // (D14's addendum).
  app.post<{ Params: { id: string } }>("/conversation/:id/providers/select", async (request, reply) => {
    const state = getSession(request.params.id);
    if (!state) {
      reply.code(404);
      return { error: "Session not found" };
    }

    const parsedBody = SelectProviderBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      reply.code(400);
      return { error: "Invalid request body: 'candidate' must be a valid ProviderCandidate." };
    }

    try {
      const answers = await select({ candidate: parsedBody.data.candidate, state });
      return { answers };
    } catch (error) {
      if (
        error instanceof GeminiConfigError ||
        error instanceof GeminiParseError ||
        error instanceof GeminiValidationError
      ) {
        app.log.error(error);
        reply.code(502);
        return { error: "Upstream language model call failed." };
      }
      app.log.error(error);
      reply.code(500);
      return { error: "Unexpected server error." };
    }
  });

  return app;
}
