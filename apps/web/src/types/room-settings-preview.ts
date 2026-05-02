import type { RoomSettings } from '@guess-the-word/shared'

export const roomSettingsPreview: RoomSettings = {
  mode: 'coop',
  totalRounds: 3,
  attemptsPerRound: 7,
  pvpTimerSeconds: 120,
  submissionMode: 'manual_submit',
  maxPlayers: 4,
  maxWordLength: 6,
  roundSummaryAutoAdvanceSeconds: 60,
}
