import { FormEvent, useState } from 'react';
import { ArrowRight, Bot, Users } from 'lucide-react';
import {
  AIDifficulty,
  GameDoc,
  GameMode,
  SymbolMark,
} from '../lib/gameEngine';
import { normalizeGameCode } from '../lib/gameService';

interface LobbyViewProps {
  currentUid: string;
  myGames: GameDoc[];
  isCreating: boolean;
  isJoining: boolean;
  joinError: string | null;
  onCreateMatch: (opts: {
    mode: GameMode;
    aiDifficulty: AIDifficulty;
    hostSymbol: SymbolMark;
  }) => void;
  onJoinMatch: (code: string) => void;
  onOpenMatch: (code: string) => void;
  showOnlyMatches?: boolean;
}

export function LobbyView({
  currentUid,
  myGames,
  isCreating,
  isJoining,
  joinError,
  onCreateMatch,
  onJoinMatch,
  onOpenMatch,
  showOnlyMatches = false,
}: LobbyViewProps) {
  const [mode, setMode] = useState<GameMode>('AI');
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('unbeatable');
  const [hostSymbol, setHostSymbol] = useState<SymbolMark>('X');
  const [joinCode, setJoinCode] = useState('');

  const handleJoinSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = normalizeGameCode(joinCode);
    if (cleaned.length === 6) {
      onJoinMatch(cleaned);
    }
  };

  return (
    <div className="space-y-8">
      {!showOnlyMatches && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: New Match Builder (7 cols) */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 text-balance">
                Start a New Match
              </h1>
              <p className="text-sm text-slate-600 mt-2 max-w-xl">
                Every move and turn rollback is stored as an immutable Firestore event document and replayed in real time.
              </p>

              {/* Opponent Mode Selector */}
              <div className="mt-6">
                <span className="block text-xs font-semibold text-slate-700 mb-2">
                  Opponent
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('AI')}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      mode === 'AI'
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                      <Bot className="w-4 h-4 text-blue-600" />
                      Minimax AI
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Deterministic game-tree search opponent
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('MULTIPLAYER')}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      mode === 'MULTIPLAYER'
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                      <Users className="w-4 h-4 text-rose-600" />
                      Friend Online
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Generate a 6-character code &amp; share link
                    </p>
                  </button>
                </div>
              </div>

              {/* Conditional AI Difficulty */}
              {mode === 'AI' && (
                <div className="mt-5">
                  <span className="block text-xs font-semibold text-slate-700 mb-2">
                    AI Strength
                  </span>
                  <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg">
                    {(
                      [
                        { id: 'casual', label: 'Casual' },
                        { id: 'tactical', label: 'Tactical' },
                        { id: 'unbeatable', label: 'Unbeatable' },
                      ] as const
                    ).map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setAiDifficulty(tier.id)}
                        className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          aiDifficulty === tier.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tier.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Symbol Selection */}
              <div className="mt-5">
                <span className="block text-xs font-semibold text-slate-700 mb-2">
                  Your Side
                </span>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setHostSymbol('X')}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      hostSymbol === 'X'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Play as X (Moves First)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHostSymbol('O')}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      hostSymbol === 'O'
                        ? 'bg-white text-rose-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Play as O (Moves Second)
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-7 pt-5 border-t border-slate-100 flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500">
                {mode === 'AI'
                  ? 'Starts immediately on board'
                  : 'Creates private room with share link'}
              </span>
              <button
                type="button"
                disabled={isCreating}
                onClick={() =>
                  onCreateMatch({
                    mode,
                    aiDifficulty,
                    hostSymbol,
                  })
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {isCreating
                  ? 'Creating...'
                  : mode === 'AI'
                    ? 'Start AI Match'
                    : 'Create Invite Room'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* Right: Join by Code (5 cols) */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900">
                Join with Match Code
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                Have a 6-character code from a friend? Enter it below to enter their match immediately.
              </p>

              <form onSubmit={handleJoinSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="join-code-input"
                    className="block text-xs font-semibold text-slate-700 mb-2"
                  >
                    6-Character Match Code
                  </label>
                  <input
                    id="join-code-input"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(normalizeGameCode(e.target.value))}
                    placeholder="e.g. K7M9P2"
                    className="w-full px-4 py-3 font-mono text-lg tracking-widest uppercase text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-2 focus:outline-blue-600"
                  />
                </div>

                {joinError && (
                  <p className="text-xs font-medium text-rose-600" role="alert">
                    {joinError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isJoining || normalizeGameCode(joinCode).length !== 6}
                  className="w-full py-2.5 px-4 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isJoining ? 'Joining Match...' : 'Join Match'}
                </button>
              </form>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 text-xs text-slate-500">
              Tip: Opening a shared link automatically joins you into the match as soon as you sign in.
            </div>
          </section>
        </div>
      )}

      {/* Recent & Active Matches */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Your Match History
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {myGames.length} {myGames.length === 1 ? 'match' : 'matches'} synced to your Google account
            </p>
          </div>
        </div>

        {myGames.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-700">No matches played yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Start an AI game or create an invite link above to play your first match.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {myGames.map((g) => {
              const isHost = g.hostUid === currentUid;
              const opponent = isHost
                ? g.guestName || 'Waiting for opponent'
                : g.hostName;
              const yourSide = isHost
                ? g.hostSymbol
                : g.hostSymbol === 'X'
                  ? 'O'
                  : 'X';

              return (
                <div
                  key={g.code}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-900">
                        {g.code}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {g.mode === 'AI'
                          ? `vs Minimax AI (${g.aiDifficulty})`
                          : `vs ${opponent}`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Playing {yourSide}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{g.eventCount} events</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 mt-1">
                      {g.status === 'WAITING'
                        ? 'Waiting for guest to join'
                        : g.status === 'ARCHIVED'
                          ? 'Archived match'
                          : 'Active match'}
                      {' · '}
                      <span className="text-xs font-normal text-slate-500">
                        Updated {new Date(g.updatedAtMs).toLocaleDateString()}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenMatch(g.code)}
                    className="px-4 py-2 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
                  >
                    Open Match
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
