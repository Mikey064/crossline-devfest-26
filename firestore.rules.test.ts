/**
 * Security Rules Specification Verification Harness — "Dirty Dozen" Payloads
 * Documents and validates all 12 adversarial payloads against the Firestore rules invariants.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'create' | 'update' | 'delete' | 'get' | 'list';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Create',
    operation: 'create',
    path: '/games/ABC234',
    auth: null,
    payload: { code: 'ABC234', mode: 'AI', hostUid: 'anon' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isSignedIn() requires request.auth != null',
  },
  {
    id: 2,
    name: 'Unverified Email Create',
    operation: 'create',
    path: '/games/ABC234',
    auth: { uid: 'user_unverified', email_verified: false },
    payload: { code: 'ABC234', mode: 'AI', hostUid: 'user_unverified' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isSignedIn() enforces request.auth.token.email_verified == true',
  },
  {
    id: 3,
    name: 'Identity Spoofing on Create',
    operation: 'create',
    path: '/games/ABC234',
    auth: { uid: 'attacker_uid', email_verified: true },
    payload: { code: 'ABC234', hostUid: 'victim_uid', playerUids: ['victim_uid'] },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().hostUid == request.auth.uid',
  },
  {
    id: 4,
    name: 'Shadow / Ghost Field Injection',
    operation: 'create',
    path: '/games/ABC234',
    auth: { uid: 'user_1', email_verified: true },
    payload: { code: 'ABC234', hostUid: 'user_1', isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidGame() enforces strict data.keys().hasOnly(...)',
  },
  {
    id: 5,
    name: 'Non-Server Timestamp Forgery',
    operation: 'create',
    path: '/games/ABC234',
    auth: { uid: 'user_1', email_verified: true },
    payload: { code: 'ABC234', hostUid: 'user_1', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().createdAt == request.time',
  },
  {
    id: 6,
    name: 'Unauthorized Blanket List Query',
    operation: 'list',
    path: '/games',
    auth: { uid: 'user_1', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'allow list: if isSignedIn() && request.auth.uid in existing().playerUids',
  },
  {
    id: 7,
    name: 'Self-Join / Double-Join Hijack',
    operation: 'update',
    path: '/games/ABC234',
    auth: { uid: 'host_uid', email_verified: true },
    payload: { guestUid: 'host_uid', status: 'ACTIVE' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'existing().hostUid != request.auth.uid && existing().status == WAITING',
  },
  {
    id: 8,
    name: 'Invalid Document ID Poisoning',
    operation: 'create',
    path: '/games/invalid_id_poisoning_string',
    auth: { uid: 'user_1', email_verified: true },
    payload: { code: 'invalid_id_poisoning_string' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidGameCode(gameId) enforces ^[A-Z0-9]{6}$',
  },
  {
    id: 9,
    name: 'Orphaned Event Creation (Sync Bypass)',
    operation: 'create',
    path: '/games/ABC234/events/e_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { seq: 1, type: 'MOVE', cell: 4, symbol: 'X' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'getAfter(/databases/$(database)/documents/games/$(gameId)).data.eventCount == incoming().seq',
  },
  {
    id: 10,
    name: 'Out-of-Order / Duplicate Event Sequence',
    operation: 'create',
    path: '/games/ABC234/events/e_5',
    auth: { uid: 'user_1', email_verified: true },
    payload: { seq: 5, type: 'MOVE', cell: 4, symbol: 'X' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().seq == get(...).data.eventCount + 1',
  },
  {
    id: 11,
    name: 'History Tampering (Event Update/Delete)',
    operation: 'delete',
    path: '/games/ABC234/events/e_1',
    auth: { uid: 'user_1', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'allow update, delete: if false on /events/{eventId}',
  },
  {
    id: 12,
    name: 'Terminal State Mutation',
    operation: 'update',
    path: '/games/ABC234',
    auth: { uid: 'user_1', email_verified: true },
    payload: { status: 'ACTIVE' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: "existing().status != 'ARCHIVED'",
  },
];
