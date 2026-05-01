import type { GuessSubmissionMode, LobbyRoomSnapshot } from '@guess-the-word/shared'

export function formatSubmissionMode(value: GuessSubmissionMode): string {
  return value === 'auto_send' ? 'Automático' : 'Manual'
}

export function formatTimer(value: number | null): string {
  return value === null ? 'Sin temporizador' : `${value} s`
}

export function formatMode(value: LobbyRoomSnapshot['settings']['mode']): string {
  return value === 'pvp' ? 'PVP' : 'Cooperativo'
}

export function formatConnectionState(value: 'connected' | 'disconnected' | 'reconnecting'): string {
  if (value === 'connected') {
    return 'En línea'
  }

  if (value === 'reconnecting') {
    return 'Reconectando'
  }

  return 'Desconectado'
}

export function getStartMessage(room: LobbyRoomSnapshot, isHost: boolean): string {
  if (!isHost) {
    return 'Espera a que el anfitrión pulse empezar.'
  }

  const connectedPlayersCount = room.players.filter((player) => player.connectionState === 'connected').length

  if (room.settings.mode === 'pvp' && connectedPlayersCount < 2) {
    return 'Falta 1 jugador más para arrancar el PVP.'
  }

  return 'Todo listo. Puedes empezar cuando quieras.'
}
