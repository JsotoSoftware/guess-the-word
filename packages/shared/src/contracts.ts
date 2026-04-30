export type GameMode = 'pvp' | 'coop'

export type GuessSubmissionMode = 'auto_send' | 'manual_submit'

export type RoomStatus = 'lobby' | 'in_game' | 'match_finished' | 'closed'

export type RoomViewState = 'lobby' | 'round_active' | 'round_summary' | 'final_results'

export type PlayerConnectionState = 'connected' | 'disconnected' | 'reconnecting'

export type LetterFeedback = 'green' | 'yellow' | 'red'

export type RoundOutcome = 'won' | 'lost'

export type ChatScope = 'room'

export interface RoomSettings {
  mode: GameMode
  totalRounds: number
  attemptsPerRound: number
  pvpTimerSeconds: number | null
  submissionMode: GuessSubmissionMode
  maxPlayers: number | null
  roundSummaryAutoAdvanceSeconds: number
}

export interface PlayerSummary {
  playerId: string
  nickname: string
  isHost: boolean
  connectionState: PlayerConnectionState
  joinedAt: string
}

export interface TimerState {
  enabled: boolean
  durationSeconds: number | null
  remainingSeconds: number | null
  startedAt: string | null
  endsAt: string | null
}

export interface LetterResult {
  letter: string
  feedback: LetterFeedback
}

export interface GuessRecord {
  guess: string
  result: LetterResult[]
  submittedAt: string
  submittedByPlayerId?: string
}

export interface ScoreEntry {
  playerId: string
  nickname: string
  totalPoints: number
  currentPlacement: number | null
}

export interface ChatMessage {
  messageId: string
  roomCode: string
  scope: ChatScope
  senderPlayerId: string
  senderNickname: string
  text: string
  sentAt: string
}

export interface RoomSnapshotBase {
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

export interface LobbyRoomSnapshot extends RoomSnapshotBase {
  status: 'lobby'
  viewState: 'lobby'
  currentRoundNumber: 0
  chatMessages?: ChatMessage[]
}

export interface PvpPlayerRoundState {
  playerId: string
  nickname: string
  attemptsLeft: number
  solved: boolean
  outOfAttempts: boolean
  finishPlacement: number | null
  finishedAt: string | null
  guessHistory: GuessRecord[]
}

export interface PvpActiveRoundState {
  mode: 'pvp'
  wordLength: number
  submissionMode: GuessSubmissionMode
  timer: TimerState
  scoreboard: ScoreEntry[]
  players: PvpPlayerRoundState[]
}

export interface CoopActiveRoundState {
  mode: 'coop'
  wordLength: number
  submissionMode: GuessSubmissionMode
  status: 'active' | RoundOutcome
  attemptsLeft: number
  totalAttempts: number
  roundsWon: number
  roundsLost: number
  guessHistory: GuessRecord[]
}

export interface ActiveRoundRoomSnapshot extends RoomSnapshotBase {
  status: 'in_game'
  viewState: 'round_active'
  currentRoundNumber: number
  totalRounds: number
  round: PvpActiveRoundState | CoopActiveRoundState
  chatMessages?: ChatMessage[]
}

export interface PvpRoundPlacement {
  playerId: string
  nickname: string
  placement: number | null
  solved: boolean
  roundPoints: number
  totalPoints: number
}

export interface PvpRoundSummaryState {
  mode: 'pvp'
  secretWord: string
  timer: TimerState
  placements: PvpRoundPlacement[]
  scoreboard: ScoreEntry[]
}

export interface CoopRoundSummaryState {
  mode: 'coop'
  secretWord: string
  outcome: RoundOutcome
  attemptsLeft: number
  roundsWon: number
  roundsLost: number
}

export interface RoundSummaryRoomSnapshot extends RoomSnapshotBase {
  status: 'in_game'
  viewState: 'round_summary'
  currentRoundNumber: number
  totalRounds: number
  summary: PvpRoundSummaryState | CoopRoundSummaryState
  canCurrentPlayerAdvanceSummary: boolean
  summaryAutoAdvanceAt: string
  chatMessages?: ChatMessage[]
}

export interface PvpFinalStanding {
  playerId: string
  nickname: string
  totalPoints: number
  finalPlacement: number
}

export interface PvpFinalResultsState {
  mode: 'pvp'
  standings: PvpFinalStanding[]
}

export interface CoopFinalResultsState {
  mode: 'coop'
  totalRounds: number
  roundsWon: number
  roundsLost: number
}

export interface FinalResultsRoomSnapshot extends RoomSnapshotBase {
  status: 'match_finished'
  viewState: 'final_results'
  currentRoundNumber: number
  totalRounds: number
  finalResults: PvpFinalResultsState | CoopFinalResultsState
  chatMessages?: ChatMessage[]
}

export type RoomSnapshot =
  | LobbyRoomSnapshot
  | ActiveRoundRoomSnapshot
  | RoundSummaryRoomSnapshot
  | FinalResultsRoomSnapshot

export interface AppError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface AckSuccess<T> {
  ok: true
  data: T
}

export interface AckFailure {
  ok: false
  error: AppError
}

export type Ack<T> = AckSuccess<T> | AckFailure

export interface CreateRoomRequest {
  nickname: string
  settings: RoomSettings
}

export interface CreateRoomResponse {
  playerId: string
  resumeToken: string
  room: LobbyRoomSnapshot
}

export interface JoinRoomRequest {
  roomCode: string
  nickname: string
}

export interface JoinRoomResponse {
  playerId: string
  resumeToken: string
  room: LobbyRoomSnapshot
}

export interface ResumeSessionRequest {
  roomCode: string
  playerId: string
  resumeToken: string
}

export interface ResumeSessionResponse {
  room: RoomSnapshot
}

export interface UpdateRoomSettingsRequest {
  roomCode: string
  settings: RoomSettings
}

export interface UpdateRoomSettingsResponse {
  room: LobbyRoomSnapshot
}

export interface StartMatchRequest {
  roomCode: string
}

export interface StartMatchResponse {
  room: ActiveRoundRoomSnapshot
}

export interface ContinueRoundRequest {
  roomCode: string
}

export interface ContinueRoundResponse {
  room: ActiveRoundRoomSnapshot | FinalResultsRoomSnapshot
}

export interface SubmitGuessRequest {
  roomCode: string
  guess: string
}

export interface SubmitGuessResponse {
  accepted: boolean
}

export interface SendChatMessageRequest {
  roomCode: string
  text: string
}

export interface SendChatMessageResponse {
  message: ChatMessage
}

export interface LeaveRoomRequest {
  roomCode: string
}

export interface LeaveRoomResponse {
  roomCode: string
  leftAt: string
}

export interface CloseRoomRequest {
  roomCode: string
}

export interface CloseRoomResponse {
  roomCode: string
  closedAt: string
}

export interface RematchRequest {
  roomCode: string
}

export interface RematchResponse {
  room: LobbyRoomSnapshot
}

export interface RoomStateEvent {
  room: RoomSnapshot
}

export interface ChatMessageEvent {
  message: ChatMessage
}

export interface RoomClosedEvent {
  roomCode: string
  closedAt: string
}

export interface PresenceUpdateEvent {
  roomCode: string
  players: PlayerSummary[]
}

export interface NotificationEvent {
  type: 'info' | 'warning' | 'error'
  message: string
}

export interface ClientRoomStore {
  room: RoomSnapshot | null
  currentPlayerId: string | null
  resumeToken: string | null
  connected: boolean
  reconnecting: boolean
}
