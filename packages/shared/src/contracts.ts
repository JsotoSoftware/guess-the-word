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
