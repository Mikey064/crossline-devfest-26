import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { auth, googleProvider } from './lib/firebase';
import {
  AIDifficulty,
  computeMinimaxMove,
  GameDoc,
  GameEventDoc,
  GameMode,
  replayGameEvents,
  SymbolMark,
} from './lib/gameEngine';
import {
  appendMoveEvent,
  appendRollbackEvent,
  archiveGameMatch,
  createGameMatch,
  joinGameByCode,
  normalizeGameCode,
  subscribeToGame,
  subscribeToGameEvents,
  subscribeToMyGames,
} from './lib/gameService';
import {
  playDrawSound,
  playMoveSound,
  playRollbackSound,
  playWinSound,
} from './lib/soundFx';
import { ArchitectureView } from './components/ArchitectureView';
import { AuthGateView } from './components/AuthGateView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GameBoard } from './components/GameBoard';
import { LobbyView } from './components/LobbyView';
import { TimelinePanel } from './components/TimelinePanel';
import { AppView, TopBar } from './components/TopBar';

function readInitialGameParam(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('game');
  if (!raw) return null;
  const cleaned = normalizeGameCode(raw);
  return cleaned.length === 6 ? cleaned : null;
}

function updateUrlGameParam(code: string | null) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (code) {
    url.searchParams.set('game', code);
  } else {
    url.searchParams.delete('game');
  }
  window.history.replaceState({}, '', url.toString());
}

function CrosslineApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<AppView>('play');
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(() =>
    readInitialGameParam()
  );
  const [activeGameCode, setActiveGameCode] = useState<string | null>(null);

  const [myGames, setMyGames] = useState<GameDoc[]>([]);
  const [activeGame, setActiveGame] = useState<GameDoc | null>(null);
  const [events, setEvents] = useState<GameEventDoc[]>([]);
  const [asyncError, setAsyncError] = useState<Error | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [previewTurnNumber, setPreviewTurnNumber] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);

  const aiScheduledKeyRef = useRef<string | null>(null);
  const prevEventsLenRef = useRef<number>(0);

  // Throw async Firestore errors into ErrorBoundary cleanly
  if (asyncError) {
    throw asyncError;
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Subscribe to user's matches list
  useEffect(() => {
    if (!authReady || !user) {
      setMyGames([]);
      return;
    }
    const unsub = subscribeToMyGames(
      user.uid,
      (games) => setMyGames(games),
      (err) => setAsyncError(err)
    );
    return () => unsub();
  }, [authReady, user]);

  // Auto-handle deep-link invite ?game=CODE once signed in
  useEffect(() => {
    if (!authReady || !user || !pendingInviteCode) return;

    let cancelled = false;
    const code = pendingInviteCode;
    setPendingInviteCode(null);

    (async () => {
      setIsJoining(true);
      setJoinError(null);
      try {
        const res = await joinGameByCode(user, code);
        if (cancelled) return;
        if (res.status === 'joined' || res.status === 'already_participant') {
          setActiveGameCode(res.gameCode);
          setActiveView('play');
          updateUrlGameParam(res.gameCode);
        } else if (res.status === 'not_found') {
          setJoinError(`No match found for code ${code}.`);
          updateUrlGameParam(null);
        } else if (res.status === 'full') {
          setJoinError(`Match ${code} already has two players.`);
          updateUrlGameParam(null);
        } else if (res.status === 'archived') {
          setJoinError(`Match ${code} has been archived.`);
          updateUrlGameParam(null);
        }
      } catch (err) {
        if (!cancelled) {
          setAsyncError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) setIsJoining(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, user, pendingInviteCode]);

  // Subscribe to active game document and its event log subcollection
  useEffect(() => {
    if (!authReady || !user || !activeGameCode) {
      setActiveGame(null);
      setEvents([]);
      setPreviewTurnNumber(null);
      prevEventsLenRef.current = 0;
      aiScheduledKeyRef.current = null;
      return;
    }

    const unsubGame = subscribeToGame(
      activeGameCode,
      (gameDoc) => setActiveGame(gameDoc),
      (err) => setAsyncError(err)
    );
    const unsubEvents = subscribeToGameEvents(
      activeGameCode,
      user.uid,
      (eventList) => setEvents(eventList),
      (err) => setAsyncError(err)
    );

    return () => {
      unsubGame();
      unsubEvents();
    };
  }, [authReady, user, activeGameCode]);

  // Deterministically reconstruct game state by replaying all Firestore events
  const replayed = useMemo(() => replayGameEvents(events), [events]);

  // Sound feedback when new events arrive
  useEffect(() => {
    if (!activeGame) return;
    if (events.length > prevEventsLenRef.current && prevEventsLenRef.current > 0) {
      const latest = events[events.length - 1];
      if (latest.type === 'ROLLBACK') {
        playRollbackSound(muted);
      } else if (replayed.winner === 'X' || replayed.winner === 'O') {
        playWinSound(muted);
      } else if (replayed.winner === 'DRAW') {
        playDrawSound(muted);
      } else if (latest.symbol === 'X' || latest.symbol === 'O') {
        playMoveSound(latest.symbol, muted);
      }
    }
    prevEventsLenRef.current = events.length;
  }, [events, replayed.winner, activeGame, muted]);

  // Clamp preview turn if a rollback shortened history
  useEffect(() => {
    if (previewTurnNumber !== null && previewTurnNumber >= replayed.turnHistory.length) {
      setPreviewTurnNumber(null);
    }
  }, [previewTurnNumber, replayed.turnHistory.length]);

  const previewSnapshot = useMemo(() => {
    if (previewTurnNumber === null) return null;
    return replayed.turnHistory[previewTurnNumber] ?? null;
  }, [previewTurnNumber, replayed.turnHistory]);

  // Automatic Minimax AI Turn Trigger
  useEffect(() => {
    if (!user || !activeGame) return;
    if (activeGame.mode !== 'AI' || activeGame.status !== 'ACTIVE') return;
    if (replayed.winner !== null) return;
    if (previewTurnNumber !== null) return;
    if (isMutating) return;
    // Wait until Firestore game eventCount and subscribed events list are synchronized
    if (events.length !== activeGame.eventCount) return;

    const aiSymbol: SymbolMark = activeGame.hostSymbol === 'X' ? 'O' : 'X';
    if (replayed.currentTurn !== aiSymbol) return;

    const scheduleKey = `${activeGame.code}:${activeGame.eventCount}`;
    if (aiScheduledKeyRef.current === scheduleKey) return;
    aiScheduledKeyRef.current = scheduleKey;

    setIsAIThinking(true);
    const timerId = window.setTimeout(async () => {
      try {
        const difficulty: AIDifficulty =
          activeGame.aiDifficulty === 'casual' || activeGame.aiDifficulty === 'tactical'
            ? activeGame.aiDifficulty
            : 'unbeatable';
        const chosenCell = computeMinimaxMove(replayed.currentBoard, aiSymbol, difficulty);
        if (chosenCell >= 0) {
          await appendMoveEvent(user, activeGame, {
            cell: chosenCell,
            symbol: aiSymbol,
            isAIMove: true,
          });
        }
      } catch (err) {
        aiScheduledKeyRef.current = null;
        setAsyncError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsAIThinking(false);
      }
    }, 420);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    user,
    activeGame,
    events.length,
    replayed.currentTurn,
    replayed.currentBoard,
    replayed.winner,
    previewTurnNumber,
    isMutating,
  ]);

  const handleSignIn = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    try {
      await signOut(auth);
      setActiveGameCode(null);
      updateUrlGameParam(null);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCreateMatch = async (opts: {
    mode: GameMode;
    aiDifficulty: AIDifficulty;
    hostSymbol: SymbolMark;
  }) => {
    if (!user || isCreating) return;
    setIsCreating(true);
    setJoinError(null);
    try {
      const code = await createGameMatch(user, opts);
      setActiveGameCode(code);
      setActiveView('play');
      updateUrlGameParam(code);
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinMatch = async (rawCode: string) => {
    if (!user || isJoining) return;
    setIsJoining(true);
    setJoinError(null);
    try {
      const res = await joinGameByCode(user, rawCode);
      if (res.status === 'joined' || res.status === 'already_participant') {
        setActiveGameCode(res.gameCode);
        setActiveView('play');
        updateUrlGameParam(res.gameCode);
      } else if (res.status === 'not_found') {
        setJoinError('No active match found with that 6-character code.');
      } else if (res.status === 'full') {
        setJoinError('That match already has two players.');
      } else if (res.status === 'archived') {
        setJoinError('That match has been archived.');
      }
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsJoining(false);
    }
  };

  const handleOpenMatch = (code: string) => {
    setActiveGameCode(code);
    setActiveView('play');
    setPreviewTurnNumber(null);
    updateUrlGameParam(code);
  };

  const handleMakeMove = useCallback(
    async (cellIndex: number) => {
      if (!user || !activeGame || isMutating || isAIThinking) return;
      if (activeGame.status !== 'ACTIVE' || replayed.winner !== null) return;
      if (replayed.currentBoard[cellIndex] !== null) return;

      const userIsHost = user.uid === activeGame.hostUid;
      const userSymbol: SymbolMark = userIsHost
        ? activeGame.hostSymbol
        : activeGame.hostSymbol === 'X'
          ? 'O'
          : 'X';
      if (replayed.currentTurn !== userSymbol) return;

      setIsMutating(true);
      try {
        await appendMoveEvent(user, activeGame, {
          cell: cellIndex,
          symbol: userSymbol,
          isAIMove: false,
        });
      } catch (err) {
        setAsyncError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsMutating(false);
      }
    },
    [user, activeGame, isMutating, isAIThinking, replayed]
  );

  const handleRestoreToTurn = async (targetTurn: number) => {
    if (!user || !activeGame || isMutating) return;
    if (activeGame.status !== 'ACTIVE') return;
    setIsMutating(true);
    setIsAIThinking(false);
    aiScheduledKeyRef.current = null;
    try {
      await appendRollbackEvent(user, activeGame, targetTurn);
      setPreviewTurnNumber(null);
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsMutating(false);
    }
  };

  const handlePlayAgain = async () => {
    if (!user || !activeGame) return;
    if (activeGame.mode === 'AI') {
      await handleCreateMatch({
        mode: 'AI',
        aiDifficulty:
          activeGame.aiDifficulty === 'casual' || activeGame.aiDifficulty === 'tactical'
            ? activeGame.aiDifficulty
            : 'unbeatable',
        hostSymbol: activeGame.hostSymbol,
      });
    } else {
      // In multiplayer, offer resetting the board via Turn 0 rollback event or starting a new room
      await handleRestoreToTurn(0);
    }
  };

  const handleArchiveMatch = async () => {
    if (!activeGame) return;
    try {
      await archiveGameMatch(activeGame.code);
    } catch (err) {
      setAsyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleLeaveToLobby = () => {
    setActiveGameCode(null);
    setPreviewTurnNumber(null);
    updateUrlGameParam(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopBar
        user={user}
        activeView={activeView}
        onSelectView={(v) => setActiveView(v)}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        authBusy={authBusy}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {!authReady ? (
          <div className="py-20 text-center text-sm text-slate-500">
            Initializing session...
          </div>
        ) : activeView === 'how-it-works' ? (
          <ArchitectureView onBackToPlay={() => setActiveView('play')} />
        ) : !user ? (
          <AuthGateView
            pendingInviteCode={pendingInviteCode}
            authBusy={authBusy}
            authError={authError}
            onSignIn={handleSignIn}
          />
        ) : activeView === 'matches' ? (
          <LobbyView
            currentUid={user.uid}
            myGames={myGames}
            isCreating={isCreating}
            isJoining={isJoining}
            joinError={joinError}
            onCreateMatch={handleCreateMatch}
            onJoinMatch={handleJoinMatch}
            onOpenMatch={handleOpenMatch}
            showOnlyMatches
          />
        ) : activeGameCode && activeGame ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7">
              <GameBoard
                game={activeGame}
                currentUid={user.uid}
                board={replayed.currentBoard}
                currentTurn={replayed.currentTurn}
                moveCount={replayed.moveCount}
                winner={replayed.winner}
                winningLine={replayed.winningLine}
                previewSnapshot={previewSnapshot}
                isAIThinking={isAIThinking}
                isMutating={isMutating}
                muted={muted}
                onToggleMute={() => setMuted((m) => !m)}
                onMakeMove={handleMakeMove}
                onExitPreview={() => setPreviewTurnNumber(null)}
                onRestoreToTurn={handleRestoreToTurn}
                onPlayAgain={handlePlayAgain}
                onArchiveMatch={handleArchiveMatch}
                onLeaveToLobby={handleLeaveToLobby}
              />
            </div>

            <div className="lg:col-span-5">
              <TimelinePanel
                gameStatus={activeGame.status}
                turnHistory={replayed.turnHistory}
                auditLog={replayed.auditLog}
                previewTurnNumber={previewTurnNumber}
                isMutating={isMutating}
                onSelectTurnPreview={setPreviewTurnNumber}
                onRestoreToTurn={handleRestoreToTurn}
              />
            </div>
          </div>
        ) : activeGameCode ? (
          <div className="py-20 text-center text-sm text-slate-500">
            Loading match {activeGameCode}...
          </div>
        ) : (
          <LobbyView
            currentUid={user.uid}
            myGames={myGames}
            isCreating={isCreating}
            isJoining={isJoining}
            joinError={joinError}
            onCreateMatch={handleCreateMatch}
            onJoinMatch={handleJoinMatch}
            onOpenMatch={handleOpenMatch}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CrosslineApp />
    </ErrorBoundary>
  );
}
