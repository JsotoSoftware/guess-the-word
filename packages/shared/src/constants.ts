import type { RoomSettings } from './contracts'

export const DEFAULT_ROUND_SUMMARY_AUTO_ADVANCE_SECONDS = 60

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  mode: 'pvp',
  totalRounds: 5,
  attemptsPerRound: 5,
  pvpTimerSeconds: 120,
  submissionMode: 'auto_send',
  maxPlayers: 8,
  roundSummaryAutoAdvanceSeconds: DEFAULT_ROUND_SUMMARY_AUTO_ADVANCE_SECONDS,
}
