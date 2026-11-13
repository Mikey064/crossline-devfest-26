export type SymbolMark = 'X' | 'O';
export type CellValue = SymbolMark | null;
export type BoardState = [
  CellValue,
  CellValue,
  CellValue,
  CellValue,
  CellValue,
  CellValue,
  CellValue,
  CellValue,
  CellValue,
];

export type GameMode = 'AI' | 'MULTIPLAYER';
export type AIDifficulty = 'unbeatable' | 'tactical' | 'casual';
export type GameStatus = 'WAITING' | 'ACTIVE' | 'ARCHIVED';
export type GameOutcome = SymbolMark | 'DRAW' | null;

export interface GameDoc {
  code: string;
  mode: GameMode;
  aiDifficulty: AIDifficulty | 'none';
  status: GameStatus;
  hostUid: string;
  hostName: string;
  hostSymbol: SymbolMark;
  guestUid: string;
  guestName: string;
  playerUids: string[];
  eventCount: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface GameEventDoc {
  id: string;
  seq: number;
  type: 'MOVE' | 'ROLLBACK';
  createdByUid: string;
  playerUids: string[];
  actorUid: string;
  actorName: string;
  symbol: SymbolMark | '';
  cell: number;
  targetTurn: number;
  createdAtMs: number;
}

export interface TurnSnapshot {
  turnNumber: number;
  board: BoardState;
  nextTurn: SymbolMark;
  winner: GameOutcome;
  winningLine: number[] | null;
  lastMoveCell: number | null;
  lastMoveSymbol: SymbolMark | null;
  actorName: string | null;
  eventSeq: number | null;
}

export interface EventAuditEntry {
  event: GameEventDoc;
  resultingTurn: number;
  boardAfter: BoardState;
  winnerAfter: GameOutcome;
  winningLineAfter: number[] | null;
}

export interface ReplayedGameState {
  currentBoard: BoardState;
  currentTurn: SymbolMark;
  moveCount: number;
  winner: GameOutcome;
  winningLine: number[] | null;
  turnHistory: TurnSnapshot[];
  auditLog: EventAuditEntry[];
  totalEvents: number;
}

export const CELL_LABELS: readonly string[] = [
  'A1',
  'B1',
  'C1',
  'A2',
  'B2',
  'C2',
  'A3',
  'B3',
  'C3',
];

export const WINNING_LINES: readonly [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function createEmptyBoard(): BoardState {
  return [null, null, null, null, null, null, null, null, null];
}

export function evaluateBoard(board: readonly CellValue[]): {
  winner: GameOutcome;
  winningLine: number[] | null;
} {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], winningLine: [a, b, c] };
    }
  }
  if (board.every((cell) => cell !== null)) {
    return { winner: 'DRAW', winningLine: null };
  }
  return { winner: null, winningLine: null };
}

/**
 * Pure Event-Sourcing Replay Engine.
 * Reconstructs the current board, active turn timeline, and per-event audit snapshots
 * strictly by replaying the ordered stream of immutable MOVE and ROLLBACK events.
 */
export function replayGameEvents(events: readonly GameEventDoc[]): ReplayedGameState {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);

  const initialSnapshot: TurnSnapshot = {
    turnNumber: 0,
    board: createEmptyBoard(),
    nextTurn: 'X',
    winner: null,
    winningLine: null,
    lastMoveCell: null,
    lastMoveSymbol: null,
    actorName: null,
    eventSeq: null,
  };

  let turnStack: TurnSnapshot[] = [initialSnapshot];
  const auditLog: EventAuditEntry[] = [];

  for (const event of ordered) {
    if (event.type === 'MOVE') {
      const top = turnStack[turnStack.length - 1];
      const cellIdx = event.cell;
      if (
        top.winner === null &&
        cellIdx >= 0 &&
        cellIdx <= 8 &&
        top.board[cellIdx] === null &&
        (event.symbol === 'X' || event.symbol === 'O') &&
        event.symbol === top.nextTurn
      ) {
        const nextBoard = [...top.board] as BoardState;
        nextBoard[cellIdx] = event.symbol;
        const { winner, winningLine } = evaluateBoard(nextBoard);
        const nextSnapshot: TurnSnapshot = {
          turnNumber: turnStack.length,
          board: nextBoard,
          nextTurn: event.symbol === 'X' ? 'O' : 'X',
          winner,
          winningLine,
          lastMoveCell: cellIdx,
          lastMoveSymbol: event.symbol,
          actorName: event.actorName,
          eventSeq: event.seq,
        };
        turnStack.push(nextSnapshot);
      }
      const after = turnStack[turnStack.length - 1];
      auditLog.push({
        event,
        resultingTurn: after.turnNumber,
        boardAfter: after.board,
        winnerAfter: after.winner,
        winningLineAfter: after.winningLine,
      });
    } else if (event.type === 'ROLLBACK') {
      const clampedTarget = Math.max(
        0,
        Math.min(event.targetTurn, turnStack.length - 1)
      );
      turnStack = turnStack.slice(0, clampedTarget + 1);
      const after = turnStack[turnStack.length - 1];
      auditLog.push({
        event,
        resultingTurn: after.turnNumber,
        boardAfter: after.board,
        winnerAfter: after.winner,
        winningLineAfter: after.winningLine,
      });
    }
  }

  const current = turnStack[turnStack.length - 1];
  return {
    currentBoard: current.board,
    currentTurn: current.nextTurn,
    moveCount: current.turnNumber,
    winner: current.winner,
    winningLine: current.winningLine,
    turnHistory: turnStack,
    auditLog,
    totalEvents: ordered.length,
  };
}

/**
 * Minimax Algorithm with Alpha-Beta Pruning & Depth Penalty.
 * No external API or LLM calls — pure deterministic game-tree search.
 */
function minimax(
  board: CellValue[],
  depth: number,
  isMaximizing: boolean,
  aiSymbol: SymbolMark,
  humanSymbol: SymbolMark,
  alpha: number,
  beta: number
): number {
  const { winner } = evaluateBoard(board);
  if (winner === aiSymbol) return 10 - depth;
  if (winner === humanSymbol) return depth - 10;
  if (winner === 'DRAW') return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = aiSymbol;
        const score = minimax(board, depth + 1, false, aiSymbol, humanSymbol, alpha, beta);
        board[i] = null;
        if (score > best) best = score;
        if (best > alpha) alpha = best;
        if (beta <= alpha) break;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = humanSymbol;
        const score = minimax(board, depth + 1, true, aiSymbol, humanSymbol, alpha, beta);
        board[i] = null;
        if (score < best) best = score;
        if (best < beta) beta = best;
        if (beta <= alpha) break;
      }
    }
    return best;
  }
}

export function computeMinimaxMove(
  board: readonly CellValue[],
  aiSymbol: SymbolMark,
  difficulty: AIDifficulty
): number {
  const availableCells: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) availableCells.push(i);
  }
  if (availableCells.length === 0) return -1;

  // Fast opening variation when board is completely empty (center or corners are optimal)
  if (availableCells.length === 9 && difficulty === 'unbeatable') {
    const openings = [0, 2, 4, 6, 8];
    return openings[Math.floor(Math.random() * openings.length)];
  }

  const humanSymbol: SymbolMark = aiSymbol === 'X' ? 'O' : 'X';

  if (difficulty === 'casual') {
    // Take immediate winning move if available
    for (const idx of availableCells) {
      const copy = [...board];
      copy[idx] = aiSymbol;
      if (evaluateBoard(copy).winner === aiSymbol) return idx;
    }
    // Block opponent's immediate win 50% of the time
    if (Math.random() < 0.5) {
      for (const idx of availableCells) {
        const copy = [...board];
        copy[idx] = humanSymbol;
        if (evaluateBoard(copy).winner === humanSymbol) return idx;
      }
    }
    return availableCells[Math.floor(Math.random() * availableCells.length)];
  }

  // Evaluate every legal move via Minimax
  const scoredMoves: { idx: number; score: number }[] = [];
  const mutableBoard = [...board];

  for (const idx of availableCells) {
    mutableBoard[idx] = aiSymbol;
    const score = minimax(
      mutableBoard,
      0,
      false,
      aiSymbol,
      humanSymbol,
      -Infinity,
      Infinity
    );
    mutableBoard[idx] = null;
    scoredMoves.push({ idx, score });
  }

  scoredMoves.sort((a, b) => b.score - a.score);
  const topScore = scoredMoves[0].score;
  const bestMoves = scoredMoves.filter((m) => m.score === topScore);

  if (difficulty === 'tactical' && scoredMoves.length > 1 && Math.random() < 0.3) {
    const suboptimal = scoredMoves.filter((m) => m.score < topScore);
    if (suboptimal.length > 0) {
      const pickPool = suboptimal.slice(0, Math.min(2, suboptimal.length));
      return pickPool[Math.floor(Math.random() * pickPool.length)].idx;
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)].idx;
}
