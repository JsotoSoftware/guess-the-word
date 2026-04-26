# Guess the Word — Data Contracts

_Status: Phase 0.3 draft for review and confirmation before implementation._

## 1. Purpose
This document defines the shared data shapes and real-time event contracts between frontend and backend.

Its goals are:
- keep frontend and backend aligned before implementation starts
- define the authoritative room/game state model
- define the payloads for room, game, chat, and reconnect flows
- provide a clean base for a future `packages/shared` implementation

---

## 2. Contract design principles

### 2.1 Server-authoritative state
The backend is the source of truth for:
- room membership
- room settings
- host ownership
- match progression
- round state
- scoring
- chat distribution
- reconnect eligibility

### 2.2 Snapshot-first synchronization
For MVP, the safest real-time model is:
- clients send actions to the server
- server validates the action
- server emits an updated authoritative state snapshot and/or focused events

Recommended primary sync pattern:
- use a **room state snapshot** event as the main synchronization mechanism
- use smaller focused events like chat messages or notifications where convenient

### 2.3 Shared route model
Because the UX uses a single room route, the backend should expose enough state for the client to render:
- lobby
- active round
- round summary
- final results

### 2.4 Transport style
Recommended transport split:
- **Socket.IO** for room, game, chat, and live synchronization
- optional HTTP only for health checks and future admin tooling

---

## 3. Shared enums and scalar conventions

## 3.1 ID and timestamp conventions
- IDs are strings
- room codes are short uppercase strings
- timestamps use ISO 8601 strings
- durations are represented in seconds

## 3.2 Enums

```ts
type GameMode = 'pvp' | 'coop'

type GuessSubmissionMode = 'auto_send' | 'manual_submit'

type RoomStatus = 'lobby' | 'in_game' | 'match_finished' | 'closed'

type RoomViewState = 'lobby' | 'round_active' | 'round_summary' | 'final_results'

type PlayerConnectionState = 'connected' | 'disconnected' | 'reconnecting'

type LetterFeedback = 'green' | 'yellow' | 'red'

type RoundOutcome = 'won' | 'lost'

type ChatScope = 'room'
```

---

## 4. Core shared objects

## 4.1 Room settings

```ts
interface RoomSettings {
  mode: GameMode
  totalRounds: number
  attemptsPerRound: number
  pvpTimerSeconds: number | null
  submissionMode: GuessSubmissionMode
  maxPlayers: number | null
  roundSummaryAutoAdvanceSeconds: number // MVP default: 60
}
```

Rules:
- `pvpTimerSeconds` is used only when `mode === 'pvp'`
- `pvpTimerSeconds === null` means PVP has no timer
- in Co-op, `pvpTimerSeconds` should always be `null`
- `submissionMode` applies to the entire room for the current match
- default `submissionMode` is `auto_send`

## 4.2 Player summary

```ts
interface PlayerSummary {
  playerId: string
  nickname: string
  isHost: boolean
  connectionState: PlayerConnectionState
  joinedAt: string
}
```

## 4.3 Timer state

```ts
interface TimerState {
  enabled: boolean
  durationSeconds: number | null
  remainingSeconds: number | null
  startedAt: string | null
  endsAt: string | null
}
```

Rules:
- in Co-op, `enabled` should be `false`
- in PVP without timer, `enabled` should be `false`
- if `enabled === false`, the remaining timer fields may be `null`

## 4.4 Letter result

```ts
interface LetterResult {
  letter: string
  feedback: LetterFeedback
}
```

## 4.5 Guess record

```ts
interface GuessRecord {
  guess: string
  result: LetterResult[]
  submittedAt: string
  submittedByPlayerId?: string // used in Co-op history or shared displays
}
```

## 4.6 Score entry

```ts
interface ScoreEntry {
  playerId: string
  nickname: string
  totalPoints: number
  currentPlacement: number | null
}
```

## 4.7 Chat message

```ts
interface ChatMessage {
  messageId: string
  roomCode: string
  scope: ChatScope
  senderPlayerId: string
  senderNickname: string
  text: string
  sentAt: string
}
```

---

## 5. Room snapshot model

The main frontend synchronization payload should be a room snapshot.

```ts
interface RoomSnapshotBase {
  roomCode: string
  status: RoomStatus
  viewState: RoomViewState
  settings: RoomSettings
  hostPlayerId: string
  players: PlayerSummary[]
  currentPlayerId: string
  minPlayersRequired: number
  canCurrentPlayerStartMatch: boolean
  createdAt: string
}
```

## 5.1 Lobby snapshot

```ts
interface LobbyRoomSnapshot extends RoomSnapshotBase {
  status: 'lobby'
  viewState: 'lobby'
  currentRoundNumber: 0
  chatMessages?: ChatMessage[]
}
```

## 5.2 Active round snapshot

```ts
interface ActiveRoundRoomSnapshot extends RoomSnapshotBase {
  status: 'in_game'
  viewState: 'round_active'
  currentRoundNumber: number
  totalRounds: number
  round: PvpActiveRoundState | CoopActiveRoundState
  chatMessages?: ChatMessage[]
}
```

## 5.3 Round summary snapshot

```ts
interface RoundSummaryRoomSnapshot extends RoomSnapshotBase {
  status: 'in_game'
  viewState: 'round_summary'
  currentRoundNumber: number
  totalRounds: number
  summary: PvpRoundSummaryState | CoopRoundSummaryState
  canCurrentPlayerAdvanceSummary: boolean
  summaryAutoAdvanceAt: string
  chatMessages?: ChatMessage[]
}
```

Rules:
- `canCurrentPlayerAdvanceSummary` is usually true only for the host
- `summaryAutoAdvanceAt` is the authoritative timestamp for auto-advance

## 5.4 Final results snapshot

```ts
interface FinalResultsRoomSnapshot extends RoomSnapshotBase {
  status: 'match_finished'
  viewState: 'final_results'
  currentRoundNumber: number
  totalRounds: number
  finalResults: PvpFinalResultsState | CoopFinalResultsState
  chatMessages?: ChatMessage[]
}
```

## 5.5 Room snapshot union

```ts
type RoomSnapshot =
  | LobbyRoomSnapshot
  | ActiveRoundRoomSnapshot
  | RoundSummaryRoomSnapshot
  | FinalResultsRoomSnapshot
```

---

## 6. PVP contracts

## 6.1 PVP player round state

```ts
interface PvpPlayerRoundState {
  playerId: string
  nickname: string
  attemptsLeft: number
  solved: boolean
  outOfAttempts: boolean
  finishPlacement: number | null
  finishedAt: string | null
  guessHistory: GuessRecord[]
}
```

## 6.2 PVP active round state

```ts
interface PvpActiveRoundState {
  mode: 'pvp'
  wordLength: number
  submissionMode: GuessSubmissionMode
  timer: TimerState
  scoreboard: ScoreEntry[]
  players: PvpPlayerRoundState[]
}
```

Rules:
- the secret word is not included during active play
- each player has isolated `guessHistory`
- all players share the same `wordLength`

## 6.3 PVP round summary state

```ts
interface PvpRoundPlacement {
  playerId: string
  nickname: string
  placement: number | null
  solved: boolean
  roundPoints: number
  totalPoints: number
}

interface PvpRoundSummaryState {
  mode: 'pvp'
  secretWord: string
  timer: TimerState
  placements: PvpRoundPlacement[]
  scoreboard: ScoreEntry[]
}
```

## 6.4 PVP final results state

```ts
interface PvpFinalStanding {
  playerId: string
  nickname: string
  totalPoints: number
  finalPlacement: number
}

interface PvpFinalResultsState {
  mode: 'pvp'
  standings: PvpFinalStanding[]
}
```

---

## 7. Co-op contracts

## 7.1 Co-op active round state

```ts
interface CoopActiveRoundState {
  mode: 'coop'
  wordLength: number
  submissionMode: GuessSubmissionMode
  attemptsLeft: number
  totalAttempts: number
  guessHistory: GuessRecord[]
}
```

Rules:
- Co-op has no score panel
- Co-op has no active timer
- all players share the same `guessHistory`

## 7.2 Co-op round summary state

```ts
interface CoopRoundSummaryState {
  mode: 'coop'
  secretWord: string
  outcome: RoundOutcome
  attemptsLeft: number
  roundsWon: number
  roundsLost: number
}
```

## 7.3 Co-op final results state

```ts
interface CoopFinalResultsState {
  mode: 'coop'
  totalRounds: number
  roundsWon: number
  roundsLost: number
}
```

---

## 8. Request/response envelopes

For request-like Socket.IO actions, use acknowledgement payloads.

```ts
interface AppError {
  code: string
  message: string
  details?: Record<string, unknown>
}

interface AckSuccess<T> {
  ok: true
  data: T
}

interface AckFailure {
  ok: false
  error: AppError
}

type Ack<T> = AckSuccess<T> | AckFailure
```

Recommended error codes:
- `ROOM_NOT_FOUND`
- `ROOM_FULL`
- `ROOM_CLOSED`
- `NICKNAME_TAKEN`
- `NOT_HOST`
- `START_NOT_ALLOWED`
- `INVALID_SETTINGS`
- `INVALID_GUESS_LENGTH`
- `ROUND_NOT_ACTIVE`
- `GUESS_ALREADY_SUBMITTED`
- `PLAYER_NOT_IN_ROOM`
- `RECONNECT_EXPIRED`
- `UNAUTHORIZED_ACTION`
- `INTERNAL_ERROR`

---

## 9. Client -> server event contracts

## 9.1 Room creation

```ts
interface CreateRoomRequest {
  nickname: string
  settings: RoomSettings
}

interface CreateRoomResponse {
  playerId: string
  resumeToken: string
  room: LobbyRoomSnapshot
}
```

Event name:
- `room:create`

## 9.2 Room join

```ts
interface JoinRoomRequest {
  roomCode: string
  nickname: string
}

interface JoinRoomResponse {
  playerId: string
  resumeToken: string
  room: LobbyRoomSnapshot
}
```

Event name:
- `room:join`

## 9.3 Session resume

```ts
interface ResumeSessionRequest {
  roomCode: string
  playerId: string
  resumeToken: string
}

interface ResumeSessionResponse {
  room: RoomSnapshot
}
```

Event name:
- `session:resume`

## 9.4 Update room settings

```ts
interface UpdateRoomSettingsRequest {
  roomCode: string
  settings: RoomSettings
}

interface UpdateRoomSettingsResponse {
  room: LobbyRoomSnapshot
}
```

Event name:
- `room:update_settings`

Rules:
- host only
- only valid while room is in lobby

## 9.5 Start match

```ts
interface StartMatchRequest {
  roomCode: string
}

interface StartMatchResponse {
  room: ActiveRoundRoomSnapshot
}
```

Event name:
- `room:start_match`

Rules:
- host only
- requires mode-specific minimum players

## 9.6 Continue after round summary

```ts
interface ContinueRoundRequest {
  roomCode: string
}

interface ContinueRoundResponse {
  room: ActiveRoundRoomSnapshot | FinalResultsRoomSnapshot
}
```

Event name:
- `round:continue`

Rules:
- host only
- only valid while `viewState === 'round_summary'`

## 9.7 Submit guess

```ts
interface SubmitGuessRequest {
  roomCode: string
  guess: string
}

interface SubmitGuessResponse {
  accepted: boolean
}
```

Event name:
- `game:submit_guess`

Rules:
- the server is authoritative for whether the current room should have sent the guess yet
- in auto-send mode, the client should send as soon as the row is complete
- in manual-submit mode, the client should send only after the user triggers submit

## 9.8 Send chat message

```ts
interface SendChatMessageRequest {
  roomCode: string
  text: string
}

interface SendChatMessageResponse {
  message: ChatMessage
}
```

Event name:
- `chat:send`

## 9.9 Leave room

```ts
interface LeaveRoomRequest {
  roomCode: string
}

interface LeaveRoomResponse {
  roomCode: string
  leftAt: string
}
```

Event name:
- `room:leave`

## 9.10 Close room

```ts
interface CloseRoomRequest {
  roomCode: string
}

interface CloseRoomResponse {
  roomCode: string
  closedAt: string
}
```

Event name:
- `room:close`

Rules:
- host only

## 9.11 Request rematch

```ts
interface RematchRequest {
  roomCode: string
}

interface RematchResponse {
  room: LobbyRoomSnapshot
}
```

Event name:
- `room:rematch`

Rules:
- exact rematch ownership flow can be refined later
- for MVP, host-controlled rematch is acceptable

---

## 10. Server -> client event contracts

## 10.1 Full room snapshot update

```ts
interface RoomStateEvent {
  room: RoomSnapshot
}
```

Event name:
- `room:state`

This should be the main synchronization event.

## 10.2 Chat message broadcast

```ts
interface ChatMessageEvent {
  message: ChatMessage
}
```

Event name:
- `chat:message`

## 10.3 Room closed

```ts
interface RoomClosedEvent {
  roomCode: string
  closedAt: string
}
```

Event name:
- `room:closed`

Client behavior:
- immediately leave room UI
- return to landing page

## 10.4 Presence update

```ts
interface PresenceUpdateEvent {
  roomCode: string
  players: PlayerSummary[]
}
```

Event name:
- `room:presence`

Optional for MVP if `room:state` already covers this sufficiently.

## 10.5 Notification event

```ts
interface NotificationEvent {
  type: 'info' | 'warning' | 'error'
  message: string
}
```

Event name:
- `app:notification`

Examples:
- invalid room code
- host changed settings
- reconnect succeeded
- reconnect failed

---

## 11. Recommended frontend shared state shape

This is not a required wire format, but it is a useful client-side model.

```ts
interface ClientRoomStore {
  room: RoomSnapshot | null
  currentPlayerId: string | null
  resumeToken: string | null
  connected: boolean
  reconnecting: boolean
}
```

---

## 12. Items intentionally left flexible

These can be refined during implementation without breaking the main contract model:
- whether `room:presence` is separate or fully folded into `room:state`
- whether chat history is fully included in every snapshot or only on join/resume
- whether rematch returns to lobby first or starts immediately after host confirmation
- the exact set of error codes beyond the initial recommended list
- whether final results include per-round history details in MVP or later

---

## 13. Review checklist for Phase 0.3
- Confirm room, player, settings, round, chat, and score payloads exist
- Confirm PVP and Co-op contracts are both represented
- Confirm the room snapshot model covers lobby, round, summary, and final results states
- Confirm timer-optional PVP is represented
- Confirm room-level auto-send/manual-submit behavior is represented
- Confirm minimum-player-to-start behavior is represented
- Confirm host continue action and summary auto-advance are represented
- Confirm chat visibility for both lobby and in-game is supported by the contract model
- Confirm client-to-server and server-to-client event names are clear enough to implement
