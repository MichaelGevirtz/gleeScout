import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError, createConversation, getConversation, sendMessage as apiSendMessage } from "../api/client";
import type { ConversationState } from "../domain/types";

const SESSION_ID_KEY = "glee-scout-session-id";

export interface UseSessionResult {
  sessionId: string | null;
  state: ConversationState | null;
  isBootstrapping: boolean;
  bootstrapError: string | null;
  retryBootstrap: () => void;
  sendMessage: (message: string) => Promise<ConversationState>;
}

export function useSession(): UseSessionResult {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<ConversationState | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const bootstrap = useCallback(async () => {
    setIsBootstrapping(true);
    setBootstrapError(null);
    try {
      const storedSessionId = await AsyncStorage.getItem(SESSION_ID_KEY);

      if (storedSessionId) {
        try {
          const { state: resumedState } = await getConversation(storedSessionId);
          setSessionId(storedSessionId);
          setState(resumedState);
          setIsBootstrapping(false);
          return;
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 404)) {
            throw error;
          }
          // Backend restarted and lost all in-memory sessions (D9) — fall
          // through to creating a fresh one, not a user-facing error.
        }
      }

      const created = await createConversation();
      await AsyncStorage.setItem(SESSION_ID_KEY, created.sessionId);
      setSessionId(created.sessionId);
      setState(created.state);
      setIsBootstrapping(false);
    } catch (error) {
      setBootstrapError(error instanceof Error ? error.message : "Failed to start session.");
      setIsBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const sendMessage = useCallback(
    async (message: string): Promise<ConversationState> => {
      if (!sessionId) {
        throw new Error("sendMessage called before a session exists");
      }
      const { state: nextState } = await apiSendMessage(sessionId, message);
      setState(nextState);
      return nextState;
    },
    [sessionId],
  );

  return {
    sessionId,
    state,
    isBootstrapping,
    bootstrapError,
    retryBootstrap: () => {
      bootstrap();
    },
    sendMessage,
  };
}
