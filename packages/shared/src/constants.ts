import type { GameMode, RoomSettings } from './contracts'

export const ROOM_CODE_LENGTH = 6

export const DEFAULT_ROUND_SUMMARY_AUTO_ADVANCE_SECONDS = 60

export const MIN_PLAYERS_BY_MODE: Record<GameMode, number> = {
  pvp: 2,
  coop: 1,
}

export const PVP_BASE_POINTS = 100

export const PVP_PLACEMENT_BONUSES: Record<number, number> = {
  1: 50,
  2: 25,
  3: 10,
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  mode: 'coop',
  totalRounds: 3,
  attemptsPerRound: 7,
  pvpTimerSeconds: 120,
  submissionMode: 'manual_submit',
  maxPlayers: 4,
  maxWordLength: 6,
  category: 'general',
  roundSummaryAutoAdvanceSeconds: DEFAULT_ROUND_SUMMARY_AUTO_ADVANCE_SECONDS,
}
