import { useEffect, useState } from 'react';
import {
  Archive,
  Check,
  Copy,
  Link2,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  BoardState,
  CELL_LABELS,
  GameDoc,
  GameOutcome,
  SymbolMark,
  TurnSnapshot,
} from '../lib/gameEngine';

interface GameBoardProps {
  game: GameDoc;
  currentUid: string;
  board: BoardState;
  currentTurn: SymbolMark;
  moveCount: number;
  winner: GameOutcome;
  winningLine: number[] | null;
  previewSnapshot: TurnSnapshot | null;
  isAIThinking: boolean;
  isMutating: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onMakeMove: (cellIndex: number) => void;
  onExitPreview: () => void;
  onRestoreToTurn: (turnNumber: number) => void;
  onPlayAgain: () => void;
  onArchiveMatch: () => void;
  onLeaveToLobby: () => void;
}

function MarkIcon({
  symbol,
  ghost = false,
  animate = false,
}: {
  symbol: SymbolMark;
  ghost?: boolean;
  animate?: boolean;
}) {
  if (symbol === 'X') {
    return (
      <svg
        viewBox="0 0 64 64"
        className={`w-12 h-12 sm:w-14 sm:h-14 ${
          ghost ? 'text-blue-600/25' : 'text-blue-600'
        }`}
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M16 16L48 48"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          className={animate ? 'animate-mark-draw' : ''}
        />
        <path
          d="M48 16L16 48"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          className={animate ? 'animate-mark-draw' : ''}
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 64 64"
      className={`w-12 h-12 sm:w-14 sm:h-14 ${
        ghost ? 'text-rose-600/25' : 'text-rose-600'
      }`}
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="32"
        cy="32"
        r="17"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        className={animate ? 'animate-mark-draw' : ''}
      />
    </svg>
  );
}

export function GameBoard({
  game,
  currentUid,
  board,
  currentTurn,
  moveCount,
  winner,
  winningLine,
  previewSnapshot,
  isAIThinking,
  isMutating,
  muted,
  onToggleMute,
  onMakeMove,
  onExitPreview,
  onRestoreToTurn,
  onPlayAgain,
  onArchiveMatch,
  onLeaveToLobby,
}: GameBoardProps) {
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const userIsHost = currentUid === game.hostUid;
  const userSymbol: SymbolMark = userIsHost
    ? game.hostSymbol
    : game.hostSymbol === 'X'
      ? 'O'
      : 'X';

  const guestSymbol: SymbolMark = game.hostSymbol === 'X' ? 'O' : 'X';
  const playerXName = game.hostSymbol === 'X' ? game.hostName : game.guestName || 'Waiting for player';
  const playerOName = game.hostSymbol === 'O' ? game.hostName : game.guestName || 'Waiting for player';

  const isPreviewing = previewSnapshot !== null;
  const displayedBoard = previewSnapshot ? previewSnapshot.board : board;
  const displayedWinningLine = previewSnapshot ? previewSnapshot.winningLine : winningLine;
  const displayedWinner = previewSnapshot ? previewSnapshot.winner : winner;
  const displayedTurn = previewSnapshot ? previewSnapshot.nextTurn : currentTurn;

  const canHumanMove =
    !isPreviewing &&
    game.status === 'ACTIVE' &&
    winner === null &&
    !isAIThinking &&
    !isMutating &&
    currentTurn === userSymbol;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!canHumanMove) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        const idx = num - 1;
        if (board[idx] === null) {
          e.preventDefault();
          onMakeMove(idx);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canHumanMove, board, onMakeMove]);

  const handleCopy = async (type: 'code' | 'link') => {
    const shareUrl = `${window.location.origin}/?game=${game.code}`;
    const text = type === 'code' ? game.code : shareUrl;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      window.setTimeout(() => setCopiedType(null), 1800);
    } catch {
      // Fallback ignored
    }
  };

  let statusHeadline = '';
  if (isPreviewing) {
    statusHeadline = `Inspecting Turn ${previewSnapshot.turnNumber} of ${moveCount}`;
  } else if (game.status === 'WAITING') {
    statusHeadline = 'Waiting for your friend to join';
  } else if (game.status === 'ARCHIVED') {
    statusHeadline = winner
      ? winner === 'DRAW'
        ? 'Match Archived · Draw'
        : `Match Archived · ${winner} Won`
      : 'Match Archived';
  } else if (winner === 'DRAW') {
    statusHeadline = 'Draw Game · Board Full';
  } else if (winner === 'X' || winner === 'O') {
    const winnerName = winner === 'X' ? playerXName : playerOName;
    statusHeadline = `${winnerName} (${winner}) Wins`;
  } else if (isAIThinking) {
    statusHeadline = 'Minimax AI is calculating...';
  } else if (currentTurn === userSymbol) {
    statusHeadline = `Your Turn · Place ${userSymbol}`;
  } else {
    const waitingForName = currentTurn === 'X' ? playerXName : playerOName;
    statusHeadline = `${waitingForName}'s Turn (${currentTurn})`;
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
      {/* Match Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="font-mono text-slate-700">{game.code}</span>
            <span aria-hidden="true">·</span>
            <span>
              {game.mode === 'AI'
                ? `Minimax AI (${game.aiDifficulty})`
                : 'Multiplayer Match'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">Turn {moveCount}</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 mt-1 text-balance">
            {statusHeadline}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute game sounds' : 'Mute game sounds'}
            className="p-2.5 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onLeaveToLobby}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            All Matches
          </button>
        </div>
      </div>

      {/* Multiplayer Share Invite Bar */}
      {game.mode === 'MULTIPLAYER' && game.status === 'WAITING' && (
        <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Invite a friend to play
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Share code <span className="font-mono font-semibold text-slate-900">{game.code}</span> or send the direct join link.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleCopy('code')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              {copiedType === 'code' ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copiedType === 'code' ? 'Code Copied' : `Copy ${game.code}`}
            </button>
            <button
              type="button"
              onClick={() => handleCopy('link')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {copiedType === 'link' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Link2 className="w-3.5 h-3.5" />
              )}
              {copiedType === 'link' ? 'Link Copied' : 'Copy Invite Link'}
            </button>
          </div>
        </div>
      )}

      {/* Time-Travel Inspection Banner */}
      {isPreviewing && (
        <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-950">
              Time-Travel Preview · Turn {previewSnapshot.turnNumber}
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              Board moves are paused while inspecting history. Restore to continue playing from this turn.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onExitPreview}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              Return to Live
            </button>
            {game.status === 'ACTIVE' && previewSnapshot.turnNumber < moveCount && (
              <button
                type="button"
                disabled={isMutating}
                onClick={() => onRestoreToTurn(previewSnapshot.turnNumber)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-amber-700 rounded-lg hover:bg-amber-800 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore to Turn {previewSnapshot.turnNumber}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Players Strip */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div
          className={`p-3.5 rounded-lg border transition-colors ${
            displayedWinner === 'X'
              ? 'border-emerald-300 bg-emerald-50/50'
              : displayedTurn === 'X' && !displayedWinner && game.status === 'ACTIVE'
                ? 'border-blue-300 bg-blue-50/40'
                : 'border-slate-200 bg-slate-50/40'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-sm font-bold text-blue-600">Player X</span>
            <span className="text-xs text-slate-500">
              {game.hostSymbol === 'X' ? (userIsHost ? 'You' : 'Host') : !userIsHost && game.mode === 'MULTIPLAYER' ? 'You' : game.mode === 'AI' ? 'AI' : 'Guest'}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-900 mt-1 truncate">
            {playerXName}
          </p>
        </div>

        <div
          className={`p-3.5 rounded-lg border transition-colors ${
            displayedWinner === 'O'
              ? 'border-emerald-300 bg-emerald-50/50'
              : displayedTurn === 'O' && !displayedWinner && game.status === 'ACTIVE'
                ? 'border-rose-300 bg-rose-50/40'
                : 'border-slate-200 bg-slate-50/40'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-sm font-bold text-rose-600">Player O</span>
            <span className="text-xs text-slate-500">
              {game.hostSymbol === 'O' ? (userIsHost ? 'You' : 'Host') : !userIsHost && game.mode === 'MULTIPLAYER' ? 'You' : game.mode === 'AI' ? 'AI' : guestSymbol === 'O' ? 'Guest' : 'Host'}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-900 mt-1 truncate">
            {playerOName}
          </p>
        </div>
      </div>

      {/* 3x3 Tactile Game Board */}
      <div className="mt-7 flex justify-center">
        <div
          className="grid grid-cols-3 gap-3 p-3 bg-slate-100 border border-slate-200 rounded-xl w-full max-w-[380px]"
          role="grid"
          aria-label="Tic-Tac-Toe Board"
        >
          {displayedBoard.map((cell, idx) => {
            const isWinningCell = displayedWinningLine?.includes(idx) ?? false;
            const isLastPlayed =
              previewSnapshot !== null
                ? previewSnapshot.lastMoveCell === idx
                : false;
            const isPlayable = canHumanMove && cell === null;

            return (
              <button
                key={idx}
                type="button"
                disabled={!isPlayable}
                onClick={() => onMakeMove(idx)}
                aria-label={`Square ${CELL_LABELS[idx]}${cell ? `, marked ${cell}` : ', empty'}`}
                className={`group relative aspect-square min-h-[88px] rounded-lg border flex items-center justify-center transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  isWinningCell
                    ? 'bg-emerald-50 border-emerald-400'
                    : isLastPlayed
                      ? 'bg-amber-50/70 border-amber-300'
                      : cell !== null
                        ? 'bg-white border-slate-200'
                        : isPlayable
                          ? 'bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50 cursor-pointer active:scale-[0.98]'
                          : 'bg-white/70 border-slate-200/80 cursor-default'
                }`}
              >
                <span className="absolute top-1.5 left-2 font-mono text-[10px] text-slate-400 select-none">
                  {CELL_LABELS[idx]}
                </span>
                {cell ? (
                  <MarkIcon symbol={cell} animate={!isPreviewing} />
                ) : isPlayable ? (
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <MarkIcon symbol={userSymbol} ghost />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Match Footer Actions */}
      <div className="mt-7 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Keys 1–9 supported</span>
          {game.mode === 'MULTIPLAYER' && game.status === 'ACTIVE' && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => handleCopy('link')}
                className="text-slate-700 hover:text-slate-900 underline underline-offset-2"
              >
                {copiedType === 'link' ? 'Invite link copied' : 'Copy match link'}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {game.status === 'ACTIVE' && !isPreviewing && moveCount > 0 && (
            <button
              type="button"
              disabled={isMutating}
              onClick={() => onRestoreToTurn(0)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Board
            </button>
          )}

          {winner !== null && !isPreviewing && (
            <button
              type="button"
              onClick={onPlayAgain}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Play Again
            </button>
          )}

          {game.status !== 'ARCHIVED' && (
            confirmArchive ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmArchive(false);
                    onArchiveMatch();
                  }}
                  className="px-3 py-2 text-xs font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors whitespace-nowrap shrink-0"
                >
                  Confirm Archive
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmArchive(false)}
                  className="px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmArchive(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                <Archive className="w-3.5 h-3.5" />
                Archive
              </button>
            )
          )}
        </div>
      </div>
    </section>
  );
}
