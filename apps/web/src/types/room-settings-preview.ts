import type { RoomSettings } from '@guess-the-word/shared'

export const roomSettingsPreview: RoomSettings = {
  mode: 'pvp',
  totalRounds: 5,
  attemptsPerRound: 5,
  pvpTimerSeconds: 120,
  submissionMode: 'auto_send',
  maxPlayers: 8,
  roundSummaryAutoAdvanceSeconds: 60,
}
