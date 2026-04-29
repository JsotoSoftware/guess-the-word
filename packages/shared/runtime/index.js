export const ROOM_CODE_LENGTH = 6

export const DEFAULT_ROUND_SUMMARY_AUTO_ADVANCE_SECONDS = 60

export const MIN_PLAYERS_BY_MODE = {
  pvp: 2,
  coop: 1,
}

export const DEFAULT_ROOM_SETTINGS = {
  mode: 'pvp',
  totalRounds: 5,
  attemptsPerRound: 5,
  pvpTimerSeconds: 120,
  submissionMode: 'auto_send',
  maxPlayers: 8,
  roundSummaryAutoAdvanceSeconds: DEFAULT_ROUND_SUMMARY_AUTO_ADVANCE_SECONDS,
}

export const SOCKET_EVENTS = {
  serverReady: 'server:ready',
  clientPing: 'client:ping',
  roomCreate: 'room:create',
  roomJoin: 'room:join',
  sessionResume: 'session:resume',
  roomUpdateSettings: 'room:update_settings',
  roomStartMatch: 'room:start_match',
  roundContinue: 'round:continue',
  gameSubmitGuess: 'game:submit_guess',
  chatSend: 'chat:send',
  roomLeave: 'room:leave',
  roomClose: 'room:close',
  roomRematch: 'room:rematch',
  roomState: 'room:state',
  chatMessage: 'chat:message',
  roomClosed: 'room:closed',
  roomPresence: 'room:presence',
  appNotification: 'app:notification',
}
