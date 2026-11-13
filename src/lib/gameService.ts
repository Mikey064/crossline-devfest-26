import { User } from 'firebase/auth';
import {
  collection,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  AIDifficulty,
  GameDoc,
  GameEventDoc,
  GameMode,
  SymbolMark,
} from './gameEngine';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function sanitizeDisplayName(name: string | null | undefined, fallbackEmail?: string | null): string {
  const raw = (name || fallbackEmail?.split('@')[0] || 'Player').trim();
  const clamped = raw.slice(0, 60);
  return clamped.length > 0 ? clamped : 'Player';
}

export function normalizeGameCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function generateCandidateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

function mapGameDoc(data: DocumentData): GameDoc {
  return {
    code: String(data.code || ''),
    mode: data.mode === 'AI' ? 'AI' : 'MULTIPLAYER',
    aiDifficulty: data.aiDifficulty || 'none',
    status: data.status || 'ACTIVE',
    hostUid: String(data.hostUid || ''),
    hostName: String(data.hostName || 'Player 1'),
    hostSymbol: data.hostSymbol === 'O' ? 'O' : 'X',
    guestUid: String(data.guestUid || ''),
    guestName: String(data.guestName || ''),
    playerUids: Array.isArray(data.playerUids) ? data.playerUids.map(String) : [],
    eventCount: typeof data.eventCount === 'number' ? data.eventCount : 0,
    createdAtMs: toMillis(data.createdAt),
    updatedAtMs: toMillis(data.updatedAt),
  };
}

function mapEventDoc(id: string, data: DocumentData): GameEventDoc {
  return {
    id,
    seq: typeof data.seq === 'number' ? data.seq : 0,
    type: data.type === 'ROLLBACK' ? 'ROLLBACK' : 'MOVE',
    createdByUid: String(data.createdByUid || ''),
    playerUids: Array.isArray(data.playerUids) ? data.playerUids.map(String) : [],
    actorUid: String(data.actorUid || ''),
    actorName: String(data.actorName || 'Player'),
    symbol: data.symbol === 'X' || data.symbol === 'O' ? data.symbol : '',
    cell: typeof data.cell === 'number' ? data.cell : -1,
    targetTurn: typeof data.targetTurn === 'number' ? data.targetTurn : -1,
    createdAtMs: toMillis(data.createdAt),
  };
}

export async function createGameMatch(
  user: User,
  options: {
    mode: GameMode;
    aiDifficulty: AIDifficulty;
    hostSymbol: SymbolMark;
  }
): Promise<string> {
  const hostName = sanitizeDisplayName(user.displayName, user.email);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCandidateCode();
    const gameRef = doc(db, 'games', code);

    let existingSnap;
    try {
      existingSnap = await getDoc(gameRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `games/${code}`);
    }

    if (existingSnap.exists()) {
      continue;
    }

    const isAI = options.mode === 'AI';
    const payload = {
      code,
      mode: options.mode,
      aiDifficulty: isAI ? options.aiDifficulty : 'none',
      status: isAI ? 'ACTIVE' : 'WAITING',
      hostUid: user.uid,
      hostName,
      hostSymbol: options.hostSymbol,
      guestUid: isAI ? 'AI_BOT' : '',
      guestName: isAI ? 'Minimax AI' : '',
      playerUids: [user.uid],
      eventCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(gameRef, payload);
      return code;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `games/${code}`);
    }
  }

  throw new Error('Could not allocate a unique game code. Please try again.');
}

export type JoinGameResult =
  | { status: 'joined'; gameCode: string }
  | { status: 'already_participant'; gameCode: string }
  | { status: 'not_found' }
  | { status: 'full' }
  | { status: 'archived' };

export async function joinGameByCode(user: User, rawCode: string): Promise<JoinGameResult> {
  const code = normalizeGameCode(rawCode);
  if (code.length !== 6) {
    return { status: 'not_found' };
  }

  const gameRef = doc(db, 'games', code);
  let snap;
  try {
    snap = await getDoc(gameRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `games/${code}`);
  }

  if (!snap.exists()) {
    return { status: 'not_found' };
  }

  const game = mapGameDoc(snap.data());

  if (game.playerUids.includes(user.uid)) {
    return { status: 'already_participant', gameCode: code };
  }

  if (game.status === 'ARCHIVED') {
    return { status: 'archived' };
  }

  if (game.mode !== 'MULTIPLAYER' || game.status !== 'WAITING' || game.guestUid !== '') {
    return { status: 'full' };
  }

  const guestName = sanitizeDisplayName(user.displayName, user.email);
  try {
    await updateDoc(gameRef, {
      guestUid: user.uid,
      guestName,
      playerUids: [game.hostUid, user.uid],
      status: 'ACTIVE',
      updatedAt: serverTimestamp(),
    });
    return { status: 'joined', gameCode: code };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `games/${code}`);
  }
}

export async function appendMoveEvent(
  user: User,
  game: GameDoc,
  params: {
    cell: number;
    symbol: SymbolMark;
    isAIMove?: boolean;
  }
): Promise<void> {
  const nextSeq = game.eventCount + 1;
  const eventId = `e_${nextSeq}`;
  const gameRef = doc(db, 'games', game.code);
  const eventRef = doc(db, 'games', game.code, 'events', eventId);

  const actorName = params.isAIMove
    ? 'Minimax AI'
    : sanitizeDisplayName(user.displayName, user.email);

  const batch = writeBatch(db);
  batch.set(eventRef, {
    seq: nextSeq,
    type: 'MOVE',
    createdByUid: user.uid,
    playerUids: game.playerUids,
    actorUid: params.isAIMove ? 'AI_BOT' : user.uid,
    actorName,
    symbol: params.symbol,
    cell: params.cell,
    targetTurn: -1,
    createdAt: serverTimestamp(),
  });
  batch.update(gameRef, {
    eventCount: nextSeq,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `games/${game.code}/events/${eventId}`);
  }
}

export async function appendRollbackEvent(
  user: User,
  game: GameDoc,
  targetTurn: number
): Promise<void> {
  const nextSeq = game.eventCount + 1;
  const eventId = `e_${nextSeq}`;
  const gameRef = doc(db, 'games', game.code);
  const eventRef = doc(db, 'games', game.code, 'events', eventId);

  const actorName = sanitizeDisplayName(user.displayName, user.email);

  const batch = writeBatch(db);
  batch.set(eventRef, {
    seq: nextSeq,
    type: 'ROLLBACK',
    createdByUid: user.uid,
    playerUids: game.playerUids,
    actorUid: user.uid,
    actorName,
    symbol: '',
    cell: -1,
    targetTurn,
    createdAt: serverTimestamp(),
  });
  batch.update(gameRef, {
    eventCount: nextSeq,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `games/${game.code}/events/${eventId}`);
  }
}

export async function archiveGameMatch(gameCode: string): Promise<void> {
  const gameRef = doc(db, 'games', gameCode);
  try {
    await updateDoc(gameRef, {
      status: 'ARCHIVED',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `games/${gameCode}`);
  }
}

export function subscribeToMyGames(
  uid: string,
  onData: (games: GameDoc[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'games';
  const q = query(collection(db, path), where('playerUids', 'array-contains', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => mapGameDoc(d.data()))
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToGame(
  gameCode: string,
  onData: (game: GameDoc | null) => void,
  onError: (err: Error) => void
): () => void {
  const path = `games/${gameCode}`;
  return onSnapshot(
    doc(db, 'games', gameCode),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      onData(mapGameDoc(snapshot.data()));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToGameEvents(
  gameCode: string,
  uid: string,
  onData: (events: GameEventDoc[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = `games/${gameCode}/events`;
  const q = query(
    collection(db, 'games', gameCode, 'events'),
    where('playerUids', 'array-contains', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => mapEventDoc(d.id, d.data()))
        .sort((a, b) => a.seq - b.seq);
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}
