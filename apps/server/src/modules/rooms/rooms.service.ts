import { Injectable } from '@nestjs/common'
import {
  DEFAULT_ROUND_SUMMARY_AUTO_ADVANCE_SECONDS,
  MIN_PLAYERS_BY_MODE,
  ROOM_CODE_LENGTH,
  type CreateRoomResponse,
  type GameMode,
  type JoinRoomResponse,
  type LobbyRoomSnapshot,
  type PlayerConnectionState,
  type PlayerSummary,
  type RoomSettings,
  type RoomStatus,
} from '@guess-the-word/shared'
import { randomBytes, randomUUID } from 'node:crypto'

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MAX_ROOM_CODE_ATTEMPTS = 100

class RoomActionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'RoomActionError'
  }
}

export class InvalidNicknameError extends RoomActionError {
  constructor() {
    super('INVALID_NICKNAME', 'Debes indicar un apodo válido para continuar.')
  }
}

export class InvalidRoomSettingsError extends RoomActionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_SETTINGS', message, details)
  }
}

export class RoomNotFoundError extends RoomActionError {
  constructor(roomCode: string) {
    super('ROOM_NOT_FOUND', `No existe una sala con el código ${roomCode}.`)
  }
}

export class RoomClosedError extends RoomActionError {
  constructor(roomCode: string) {
    super('ROOM_CLOSED', `La sala ${roomCode} ya no acepta nuevos jugadores.`, { roomCode })
  }
}

export class RoomFullError extends RoomActionError {
  constructor(roomCode: string) {
    super('ROOM_FULL', `La sala ${roomCode} alcanzó el número máximo de jugadores.`, { roomCode })
  }
}

export class NicknameTakenError extends RoomActionError {
  constructor(nickname: string) {
    super('NICKNAME_TAKEN', `El apodo ${nickname} ya está en uso dentro de la sala.`, { nickname })
  }
}

interface LivePlayer {
  playerId: string
  nickname: string
  isHost: boolean
  connectionState: PlayerConnectionState
  joinedAt: string
  socketId: string
  resumeToken: string
}

interface LiveRoom {
  roomCode: string
  status: RoomStatus
  settings: RoomSettings
  hostPlayerId: string
  players: LivePlayer[]
  createdAt: string
}

interface CreateRoomInput {
  nickname: string
  settings: RoomSettings
  socketId: string
}

interface JoinRoomInput {
  roomCode: string
  nickname: string
  socketId: string
}

interface RoomStateTarget {
  socketId: string
  room: LobbyRoomSnapshot
}

@Injectable()
export class RoomsService {
  private readonly rooms = new Map<string, LiveRoom>()

  createRoom(input: CreateRoomInput): CreateRoomResponse {
    const createdAt = new Date().toISOString()
    const roomCode = this.generateUniqueRoomCode()
    const nickname = this.normalizeNickname(input.nickname)
    const settings = this.normalizeSettings(input.settings)
    const hostPlayerId = randomUUID()
    const hostPlayer = this.createLivePlayer({
      playerId: hostPlayerId,
      nickname,
      isHost: true,
      socketId: input.socketId,
      joinedAt: createdAt,
    })

    const room: LiveRoom = {
      roomCode,
      status: 'lobby',
      settings,
      hostPlayerId,
      players: [hostPlayer],
      createdAt,
    }

    this.rooms.set(roomCode, room)

    return {
      playerId: hostPlayer.playerId,
      resumeToken: hostPlayer.resumeToken,
      room: this.buildLobbySnapshot(room, hostPlayer.playerId),
    }
  }

  joinRoom(input: JoinRoomInput): JoinRoomResponse {
    const roomCode = input.roomCode.trim().toUpperCase()
    const room = this.rooms.get(roomCode)

    if (!room) {
      throw new RoomNotFoundError(roomCode)
    }

    if (room.status !== 'lobby') {
      throw new RoomClosedError(roomCode)
    }

    if (room.settings.maxPlayers !== null && room.players.length >= room.settings.maxPlayers) {
      throw new RoomFullError(roomCode)
    }

    const nickname = this.normalizeNickname(input.nickname)

    if (room.players.some((player) => player.nickname.toLocaleLowerCase() === nickname.toLocaleLowerCase())) {
      throw new NicknameTakenError(nickname)
    }

    const player = this.createLivePlayer({
      playerId: randomUUID(),
      nickname,
      isHost: false,
      socketId: input.socketId,
      joinedAt: new Date().toISOString(),
    })

    room.players.push(player)

    return {
      playerId: player.playerId,
      resumeToken: player.resumeToken,
      room: this.buildLobbySnapshot(room, player.playerId),
    }
  }

  closeRoom(roomCode: string): void {
    const room = this.getRoomOrThrow(roomCode)
    room.status = 'closed'
  }

  getRoomStateTargets(roomCode: string): RoomStateTarget[] {
    const room = this.getRoomOrThrow(roomCode)

    return room.players.map((player) => ({
      socketId: player.socketId,
      room: this.buildLobbySnapshot(room, player.playerId),
    }))
  }

  private getRoomOrThrow(roomCode: string): LiveRoom {
    const normalizedRoomCode = roomCode.trim().toUpperCase()
    const room = this.rooms.get(normalizedRoomCode)

    if (!room) {
      throw new RoomNotFoundError(normalizedRoomCode)
    }

    return room
  }

  private createLivePlayer(input: {
    playerId: string
    nickname: string
    isHost: boolean
    socketId: string
    joinedAt: string
  }): LivePlayer {
    return {
      playerId: input.playerId,
      nickname: input.nickname,
      isHost: input.isHost,
      connectionState: 'connected',
      joinedAt: input.joinedAt,
      socketId: input.socketId,
      resumeToken: randomBytes(24).toString('hex'),
    }
  }

  private buildLobbySnapshot(room: LiveRoom, currentPlayerId: string): LobbyRoomSnapshot {
    const minPlayersRequired = MIN_PLAYERS_BY_MODE[room.settings.mode]
    const currentPlayer = room.players.find((player) => player.playerId === currentPlayerId)

    if (!currentPlayer) {
      throw new RoomNotFoundError(room.roomCode)
    }

    return {
      roomCode: room.roomCode,
      status: 'lobby',
      viewState: 'lobby',
      settings: room.settings,
      hostPlayerId: room.hostPlayerId,
      players: room.players.map((player) => this.toPlayerSummary(player, room.hostPlayerId)),
      currentPlayerId,
      minPlayersRequired,
      canCurrentPlayerStartMatch: currentPlayer.isHost && room.players.length >= minPlayersRequired,
      createdAt: room.createdAt,
      currentRoundNumber: 0,
      chatMessages: [],
    }
  }

  private toPlayerSummary(player: LivePlayer, hostPlayerId: string): PlayerSummary {
    return {
      playerId: player.playerId,
      nickname: player.nickname,
      isHost: player.playerId === hostPlayerId,
      connectionState: player.connectionState,
      joinedAt: player.joinedAt,
    }
  }

  private normalizeNickname(nickname: string): string {
    const normalizedNickname = nickname.trim()

    if (!normalizedNickname) {
      throw new InvalidNicknameError()
    }

    return normalizedNickname.slice(0, 24)
  }

  private normalizeSettings(settings: RoomSettings): RoomSettings {
    const mode = this.normalizeMode(settings.mode)
    const totalRounds = this.ensurePositiveInteger(settings.totalRounds, 'totalRounds')
    const attemptsPerRound = this.ensurePositiveInteger(settings.attemptsPerRound, 'attemptsPerRound')
    const roundSummaryAutoAdvanceSeconds = this.ensurePositiveInteger(
      settings.roundSummaryAutoAdvanceSeconds ?? DEFAULT_ROUND_SUMMARY_AUTO_ADVANCE_SECONDS,
      'roundSummaryAutoAdvanceSeconds',
    )

    const pvpTimerSeconds = mode === 'pvp'
      ? settings.pvpTimerSeconds === null
        ? null
        : this.ensurePositiveInteger(settings.pvpTimerSeconds, 'pvpTimerSeconds')
      : null

    const maxPlayers = settings.maxPlayers === null
      ? null
      : this.ensurePositiveInteger(settings.maxPlayers, 'maxPlayers')

    if (maxPlayers !== null && maxPlayers < MIN_PLAYERS_BY_MODE[mode]) {
      throw new InvalidRoomSettingsError('La cantidad máxima de jugadores es incompatible con el modo seleccionado.', {
        mode,
        maxPlayers,
        minPlayersRequired: MIN_PLAYERS_BY_MODE[mode],
      })
    }

    return {
      mode,
      totalRounds,
      attemptsPerRound,
      pvpTimerSeconds,
      submissionMode: settings.submissionMode,
      maxPlayers,
      roundSummaryAutoAdvanceSeconds,
    }
  }

  private normalizeMode(mode: GameMode): GameMode {
    if (mode !== 'pvp' && mode !== 'coop') {
      throw new InvalidRoomSettingsError('El modo de juego seleccionado no es válido.', { mode })
    }

    return mode
  }

  private ensurePositiveInteger(value: number, field: string): number {
    if (!Number.isInteger(value) || value <= 0) {
      throw new InvalidRoomSettingsError(`El campo ${field} debe ser un entero positivo.`, {
        field,
        value,
      })
    }

    return value
  }

  private generateUniqueRoomCode(): string {
    for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt += 1) {
      const roomCode = this.generateRoomCode()

      if (!this.rooms.has(roomCode)) {
        return roomCode
      }
    }

    throw new Error('No se pudo generar un código de sala único.')
  }

  private generateRoomCode(): string {
    return Array.from({ length: ROOM_CODE_LENGTH }, () => {
      const randomIndex = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)
      return ROOM_CODE_ALPHABET[randomIndex]
    }).join('')
  }
}
