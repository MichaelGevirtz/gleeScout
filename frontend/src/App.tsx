import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "./hooks/useSession";
import { useIsDesktop } from "./hooks/useIsDesktop";
import { fetchProviders, fetchTrace, selectProvider } from "./api/client";
import { ChatScreen } from "./screens/ChatScreen";
import TransitionScreen from "./screens/TransitionScreen";
import { RecommendationsScreen } from "./screens/RecommendationsScreen";
import ProviderDetailsScreen from "./screens/ProviderDetailsScreen";
import { SimulatedQAScreen } from "./screens/SimulatedQAScreen";
import { TraceScreen } from "./screens/TraceScreen";
import ErrorState from "./components/ErrorState";
import ContextPanel from "./components/ContextPanel";
import type { ProviderCandidate, ProviderScore, SimulatedAnswer, TraceEvent } from "./domain/types";
import { hostnameFromUrl } from "./shared/hostname";

type Screen =
  | "chat"
  | "transitionLoading"
  | "recommendations"
  | "providerDetails"
  | "simulatedQA"
  | "trace";

interface ErrorContext {
  message: string;
  retry: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function App() {
  const session = useSession();
  const isDesktop = useIsDesktop();

  const [screen, setScreen] = useState<Screen>("chat");
  const [providers, setProviders] = useState<ProviderScore[] | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderScore | null>(null);
  const [answers, setAnswers] = useState<SimulatedAnswer[] | null>(null);
  const [traceEvents, setTraceEvents] = useState<TraceEvent[] | null>(null);
  const [errorContext, setErrorContext] = useState<ErrorContext | null>(null);

  // Guards the resume-into-an-already-ready-session case (app relaunched
  // after the conversation had already reached ready_for_search) so the
  // auto-transition below fires once on bootstrap, not on every render.
  const hasAutoTriggeredRef = useRef(false);

  const runProviderSearch = useCallback(() => {
    const sessionId = session.sessionId;
    if (!sessionId) {
      return;
    }
    setErrorContext(null);
    setScreen("transitionLoading");
    fetchProviders(sessionId)
      .then(({ providers: nextProviders }) => {
        setProviders(nextProviders);
        setScreen("recommendations");
      })
      .catch((error: unknown) => {
        setErrorContext({ message: errorMessage(error), retry: runProviderSearch });
      });
  }, [session.sessionId]);

  if (
    !hasAutoTriggeredRef.current &&
    !session.isBootstrapping &&
    session.state?.phase === "ready_for_search" &&
    providers === null &&
    screen === "chat"
  ) {
    hasAutoTriggeredRef.current = true;
    runProviderSearch();
  }

  const handleSend = useCallback(
    async (message: string) => {
      const nextState = await session.sendMessage(message);
      if (nextState.phase === "ready_for_search") {
        runProviderSearch();
      }
      return nextState;
    },
    [session, runProviderSearch],
  );

  const handleSelectRow = useCallback((provider: ProviderScore) => {
    setSelectedProvider(provider);
    setScreen("providerDetails");
  }, []);

  const runSelectProvider = useCallback(
    (candidate: ProviderCandidate) => {
      const sessionId = session.sessionId;
      if (!sessionId) {
        return;
      }
      setErrorContext(null);
      setAnswers(null);
      setScreen("simulatedQA");
      selectProvider(sessionId, candidate)
        .then(({ answers: nextAnswers }) => {
          setAnswers(nextAnswers);
        })
        .catch((error: unknown) => {
          setErrorContext({
            message: errorMessage(error),
            retry: () => runSelectProvider(candidate),
          });
        });
    },
    [session.sessionId],
  );

  const handleBackToMatches = useCallback(() => {
    setScreen("recommendations");
  }, []);

  const runFetchTrace = useCallback(() => {
    const sessionId = session.sessionId;
    if (!sessionId) {
      return;
    }
    setErrorContext(null);
    setTraceEvents(null);
    setScreen("trace");
    fetchTrace(sessionId)
      .then(({ events }) => {
        setTraceEvents(events);
      })
      .catch((error: unknown) => {
        setErrorContext({ message: errorMessage(error), retry: runFetchTrace });
      });
  }, [session.sessionId]);

  const handleOpenChat = useCallback(() => {
    setScreen("chat");
  }, []);

  if (session.isBootstrapping) {
    return <TransitionScreen />;
  }

  if (session.bootstrapError) {
    return <ErrorState message={session.bootstrapError} onRetry={session.retryBootstrap} />;
  }

  if (!session.state) {
    return null;
  }

  let content: React.ReactNode;
  if (errorContext) {
    content = <ErrorState message={errorContext.message} onRetry={errorContext.retry} />;
  } else if (screen === "chat") {
    content = <ChatScreen state={session.state} onSend={handleSend} />;
  } else if (screen === "transitionLoading") {
    content = <TransitionScreen />;
  } else if (screen === "recommendations") {
    content = (
      <RecommendationsScreen
        providers={providers ?? []}
        onSelectRow={handleSelectRow}
        onViewTrace={runFetchTrace}
      />
    );
  } else if (screen === "trace") {
    content =
      traceEvents === null ? (
        <TransitionScreen />
      ) : (
        <TraceScreen events={traceEvents} onBack={handleBackToMatches} />
      );
  } else if (screen === "providerDetails" && selectedProvider) {
    content = (
      <ProviderDetailsScreen
        candidate={selectedProvider.candidate}
        dimensionScores={selectedProvider.dimensionScores}
        explanation={selectedProvider.explanation}
        onSelectProvider={runSelectProvider}
      />
    );
  } else if (screen === "simulatedQA" && selectedProvider) {
    const providerName =
      selectedProvider.candidate.fields.name?.value ?? hostnameFromUrl(selectedProvider.candidate.url);
    content =
      answers === null ? (
        <SimulatedQAScreen phase="loading" />
      ) : (
        <SimulatedQAScreen
          phase="results"
          providerName={providerName}
          answers={answers}
          onBack={handleBackToMatches}
        />
      );
  } else {
    content = <ChatScreen state={session.state} onSend={handleSend} />;
  }

  const showSplitPane = isDesktop && providers !== null;

  if (showSplitPane) {
    const currentlyViewing =
      selectedProvider && (screen === "providerDetails" || screen === "simulatedQA")
        ? selectedProvider.candidate.fields.name?.value ?? hostnameFromUrl(selectedProvider.candidate.url)
        : undefined;

    return (
      <View style={styles.container}>
        <View style={styles.desktopRow}>
          <ContextPanel
            state={session.state}
            matchCount={providers?.length ?? 0}
            currentlyViewing={currentlyViewing}
            isChatOpen={screen === "chat"}
            onOpenChat={handleOpenChat}
            onBackToMatches={handleBackToMatches}
          />
          <View style={styles.rightPane}>
            <View style={styles.rightPaneInner}>{content}</View>
          </View>
        </View>
      </View>
    );
  }

  const isDesktopChat = isDesktop && screen === "chat";

  return (
    <View style={styles.container}>
      {screen !== "chat" && screen !== "transitionLoading" && (
        <Pressable testID="chat-pill" onPress={handleOpenChat} style={styles.chatPill}>
          <Text style={styles.chatPillText}>💬 Chat</Text>
        </Pressable>
      )}
      {isDesktopChat ? (
        <View style={styles.chatDesktopBackdrop}>
          <View style={styles.chatDesktopCard}>{content}</View>
        </View>
      ) : (
        <View style={styles.content}>{content}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  desktopRow: {
    flex: 1,
    flexDirection: "row",
  },
  rightPane: {
    flex: 1,
    alignItems: "center",
  },
  rightPaneInner: {
    width: "100%",
    maxWidth: 900,
  },
  // Desktop-only chat workspace framing (task-64): the split-pane
  // branch above only activates once `providers` is set, so the
  // gathering-phase Chat screen otherwise falls into the plain
  // full-bleed `content` branch with no width cap. This backdrop +
  // card gives Chat a bounded, centered "workspace" on wide viewports
  // without touching ChatScreen.tsx or the split-pane layout at all.
  chatDesktopBackdrop: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  chatDesktopCard: {
    flex: 1,
    width: "100%",
    maxWidth: 800,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  chatPill: {
    alignSelf: "flex-end",
    margin: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#111827",
  },
  chatPillText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
});
