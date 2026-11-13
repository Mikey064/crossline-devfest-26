# Security Specification & Payload-First TDD

## 1. Data Invariants

1. **Authenticated & Verified Identity**: All reads and writes require a signed-in user with a verified email (`request.auth != null && request.auth.token.email_verified == true`).
2. **Match Ownership & Participant Isolation**:
   - `list` queries on `/games` are strictly scoped to documents where `request.auth.uid in resource.data.playerUids`.
   - `get` on `/games/{gameId}` is allowed only if the requester is already in `playerUids`, or if the game is an open `WAITING` multiplayer match (`mode == 'MULTIPLAYER' && status == 'WAITING' && guestUid == ''`) accessed by its exact 6-character code.
   - No PII (such as email addresses or phone numbers) is stored in `/games` or `/games/{gameId}/events`.
3. **Immutable Fields & Temporal Integrity**:
   - `code`, `mode`, `aiDifficulty`, `hostUid`, `hostName`, `hostSymbol`, and `createdAt` are immutable after creation.
   - `createdAt` and `updatedAt` must strictly equal `request.time`.
4. **Action-Based Updates & Terminal State Locking**:
   - Updates to `/games/{gameId}` are partitioned into explicit actions: `Join`, `AdvanceEvent`, and `Archive`.
   - Once `status == 'ARCHIVED'`, no further updates or child event creations are permitted.
5. **Event Sourcing Integrity & Atomic Sync**:
   - Events in `/games/{gameId}/events/{eventId}` are strictly append-only (`update` and `delete` are denied).
   - `eventId` must match `'e_' + string(seq)`, where `seq == parent.eventCount + 1`.
   - Creating an event requires the parent `/games/{gameId}` document to atomically increment `eventCount` to `seq` (`getAfter(...)`) and vice-versa (`existsAfter(...)`).
   - Only current participants of an `ACTIVE` game may append events, and `createdByUid` must equal `request.auth.uid`.

## 2. The "Dirty Dozen" Attack Payloads

1. **Unauthenticated Create**: Unauthenticated user tries to create `/games/ABC234` -> `PERMISSION_DENIED`.
2. **Unverified Email Create**: User with `email_verified: false` attempts to create a match -> `PERMISSION_DENIED`.
3. **Identity Spoofing on Create**: User `attacker` attempts to create `/games/ABC234` with `hostUid: "victim"` -> `PERMISSION_DENIED`.
4. **Shadow / Ghost Field Injection**: User includes `isAdmin: true` in `/games/ABC234` creation payload -> `PERMISSION_DENIED`.
5. **Non-Server Timestamp Forgery**: User supplies a client-forged past `createdAt` timestamp instead of `request.time` -> `PERMISSION_DENIED`.
6. **Unauthorized Blanket List Query**: User runs `getDocs(collection(db, 'games'))` without filtering by their own UID -> `PERMISSION_DENIED`.
7. **Self-Join / Double-Join Hijack**: Host attempts to join their own `WAITING` multiplayer game as `guestUid`, or third user tries to overwrite `guestUid` on an `ACTIVE` game -> `PERMISSION_DENIED`.
8. **Invalid Document ID Poisoning**: User attempts to write `/games/../../bad_id_123456789` or a code not matching `^[A-Z0-9]{6}$` -> `PERMISSION_DENIED`.
9. **Orphaned Event Creation (Sync Bypass)**: Participant creates `/games/ABC234/events/e_1` without atomically incrementing `eventCount` on `/games/ABC234` -> `PERMISSION_DENIED`.
10. **Out-of-Order / Duplicate Event Sequence**: Participant tries to create `/games/ABC234/events/e_5` when `eventCount == 1` -> `PERMISSION_DENIED`.
11. **History Tampering (Event Update/Delete)**: Participant attempts to `updateDoc` or `deleteDoc` on `/games/ABC234/events/e_1` -> `PERMISSION_DENIED`.
12. **Terminal State Mutation**: Participant attempts to append an event or change `status` on a game whose `status == 'ARCHIVED'` -> `PERMISSION_DENIED`.

## 3. Verification Harness

See `/firestore.rules.test.ts` for the structured test suite verifying all 12 adversarial payloads.
