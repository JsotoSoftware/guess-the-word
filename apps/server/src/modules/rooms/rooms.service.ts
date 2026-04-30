import { Injectable } from '@nestjs/common'
import {
  DEFAULT_ROUND_SUMMARY_AUTO_ADVANCE_SECONDS,
  MIN_PLAYERS_BY_MODE,
  ROOM_CODE_LENGTH,
  type ActiveRoundRoomSnapshot,
  type CloseRoomResponse,
  type CreateRoomResponse,
  type GameMode,
  type JoinRoomResponse,
  type LeaveRoomResponse,
  type LobbyRoomSnapshot,
  type PlayerConnectionState,
  type PlayerSummary,
  type RoomClosedEvent,
  type RoomSettings,
  type RoomSnapshot,
  type RoomStatus,
  type ScoreEntry,
  type StartMatchResponse,
  type TimerState,
  type UpdateRoomSettingsResponse,
} from '@guess-the-word/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import { RoundStateService, type PvpRoundState as EnginePvpRoundState } from '../game/round-state.service'
import { WordsService } from '../words/words.service'

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const MAX_ROOM_CODE_ATTEMPTS = 100
const ROOM_IDLE_TIMEOUT_MS = 5 * 60 * 1000

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

export class NotHostError extends RoomActionError {
  constructor() {
    super('NOT_HOST', 'Solo el anfitrión puede ejecutar esta acción.')
  }
}

export class PlayerNotInRoomError extends RoomActionError {
  constructor(roomCode: string) {
    super('PLAYER_NOT_IN_ROOM', `El jugador actual no pertenece a la sala ${roomCode}.`, { roomCode })
  }
}

export class RoomNotInLobbyError extends RoomActionError {
  constructor(roomCode: string) {
    super('UNAUTHORIZED_ACTION', `La sala ${roomCode} ya no está en estado de lobby.`, { roomCode })
  }
}

export class StartNotAllowedError extends RoomActionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('START_NOT_ALLOWED', message, details)
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

interface LivePvpRound {
  state: EnginePvpRoundState
  timerDurationSeconds: number | null
  timerEndsAt: string | null
}

interface LiveRoom {
  roomCode: string
  status: RoomStatus
  settings: RoomSettings
  hostPlayerId: string
  players: LivePlayer[]
  createdAt: string
  lastActivityAt: string
  currentRoundNumber: number
  activePvpRound: LivePvpRound | null
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

interface UpdateRoomSettingsInput {
  roomCode: string
  socketId: string
  settings: RoomSettings
}

interface StartMatchInput {
  roomCode: string
  socketId: string
}

interface CloseRoomInput {
  roomCode: string
  socketId: string
}

interface LeaveRoomInput {
  roomCode: string
  socketId: string
}

interface RoomStateTarget {
  socketId: string
  room: RoomSnapshot
}

interface LeaveRoomResult {
  response: LeaveRoomResponse
  roomStillExists: boolean
}

interface RoomMembershipResult {
  roomCode: string
  roomStillExists: boolean
}

@Injectable()
export class RoomsService {
  private readonly rooms = new Map<string, LiveRoom>()
  private readonly roundStateService = new RoundStateService()

  constructor(private readonly wordsService?: WordsService) {}

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
      lastActivityAt: createdAt,
      currentRoundNumber: 0,
      activePvpRound: null,
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
    const room = this.getRoomOrThrow(roomCode)

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
    this.touchRoom(room)

    return {
      playerId: player.playerId,
      resumeToken: player.resumeToken,
      room: this.buildLobbySnapshot(room, player.playerId),
    }
  }

  updateRoomSettings(input: UpdateRoomSettingsInput): UpdateRoomSettingsResponse {
    const room = this.getRoomOrThrow(input.roomCode)
    this.ensureRoomIsLobby(room)

    const player = this.getPlayerBySocketId(room, input.socketId)

    if (player.playerId !== room.hostPlayerId) {
      throw new NotHostError()
    }

    room.settings = this.normalizeSettings(input.settings)
    this.touchRoom(room)

    return {
      room: this.buildLobbySnapshot(room, player.playerId),
    }
  }

  async startMatch(input: StartMatchInput): Promise<StartMatchResponse> {
    const room = this.getRoomOrThrow(input.roomCode)
    this.ensureRoomIsLobby(room)

    const player = this.getPlayerBySocketId(room, input.socketId)

    if (player.playerId !== room.hostPlayerId) {
      throw new NotHostError()
    }

    const minPlayersRequired = MIN_PLAYERS_BY_MODE[room.settings.mode]

    if (room.players.length < minPlayersRequired) {
      throw new StartNotAllowedError('La sala aún no cumple con el mínimo de jugadores para iniciar.', {
        currentPlayers: room.players.length,
        minPlayersRequired,
        mode: room.settings.mode,
      })
    }

    if (room.settings.mode !== 'pvp') {
      throw new StartNotAllowedError('El arranque cooperativo se implementará en la fase 5.', {
        mode: room.settings.mode,
      })
    }

    if (!this.wordsService) {
      throw new Error('WordsService is not available.')
    }

    const secretWord = await this.wordsService.getRandomSecretWord({})
    const startedAt = new Date().toISOString()
    const roundState = this.roundStateService.createPvpRoundState(
      secretWord.word,
      room.players.map((roomPlayer) => ({
        playerId: roomPlayer.playerId,
        nickname: roomPlayer.nickname,
      })),
      room.settings.attemptsPerRound,
      startedAt,
    )

    const timerDurationSeconds = room.settings.pvpTimerSeconds
    const timerEndsAt = timerDurationSeconds === null
      ? null
      : new Date(Date.parse(startedAt) + timerDurationSeconds * 1000).toISOString()

    room.status = 'in_game'
    room.currentRoundNumber = 1
    room.activePvpRound = {
      state: roundState,
      timerDurationSeconds,
      timerEndsAt,
    }
    this.touchRoom(room)

    return {
      room: this.buildActiveRoundSnapshot(room, player.playerId),
    }
  }

  closeRoom(input: CloseRoomInput): CloseRoomResponse {
    const room = this.getRoomOrThrow(input.roomCode)
    const player = this.getPlayerBySocketId(room, input.socketId)

    if (player.playerId !== room.hostPlayerId) {
      throw new NotHostError()
    }

    room.status = 'closed'
    this.rooms.delete(room.roomCode)

    return {
      roomCode: room.roomCode,
      closedAt: new Date().toISOString(),
    }
  }

  closeIdleRooms(now = new Date()): RoomClosedEvent[] {
    const closedRooms: RoomClosedEvent[] = []

    for (const room of this.rooms.values()) {
      if (room.status !== 'lobby') {
        continue
      }

      const idleTimeMs = now.getTime() - new Date(room.lastActivityAt).getTime()

      if (idleTimeMs < ROOM_IDLE_TIMEOUT_MS) {
        continue
      }

      room.status = 'closed'
      const closedAt = now.toISOString()
      this.rooms.delete(room.roomCode)
      closedRooms.push({
        roomCode: room.roomCode,
        closedAt,
      })
    }

    return closedRooms
  }

  leaveRoom(input: LeaveRoomInput): LeaveRoomResult {
    const room = this.getRoomOrThrow(input.roomCode)
    const result = this.removePlayerFromRoom(room, input.socketId)

    return {
      response: {
        roomCode: room.roomCode,
        leftAt: new Date().toISOString(),
      },
      roomStillExists: result.roomStillExists,
    }
  }

  disconnectSocket(socketId: string): RoomMembershipResult | null {
    const room = this.findRoomBySocketId(socketId)

    if (!room) {
      return null
    }

    return this.removePlayerFromRoom(room, socketId)
  }

  hasRoom(roomCode: string): boolean {
    return this.rooms.has(roomCode.trim().toUpperCase())
  }

  getRoomStateTargets(roomCode: string): RoomStateTarget[] {
    const room = this.getRoomOrThrow(roomCode)

    return room.players.map((player) => ({
      socketId: player.socketId,
      room: this.buildRoomSnapshot(room, player.playerId),
    }))
  }

  private touchRoom(room: LiveRoom): void {
    room.lastActivityAt = new Date().toISOString()
  }

  private findRoomBySocketId(socketId: string): LiveRoom | null {
    for (const room of this.rooms.values()) {
      if (room.players.some((player) => player.socketId === socketId)) {
        return room
      }
    }

    return null
  }

  private getRoomOrThrow(roomCode: string): LiveRoom {
    const normalizedRoomCode = roomCode.trim().toUpperCase()
    const room = this.rooms.get(normalizedRoomCode)

    if (!room) {
      throw new RoomNotFoundError(normalizedRoomCode)
    }

    return room
  }

  private removePlayerFromRoom(room: LiveRoom, socketId: string): RoomMembershipResult {
    const playerIndex = room.players.findIndex((player) => player.socketId === socketId)

    if (playerIndex === -1) {
      throw new PlayerNotInRoomError(room.roomCode)
    }

    const [removedPlayer] = room.players.splice(playerIndex, 1)

    if (room.activePvpRound) {
      room.activePvpRound.state = {
        ...room.activePvpRound.state,
        players: room.activePvpRound.state.players.filter((player) => player.playerId !== removedPlayer.playerId),
      }
    }

    if (room.players.length === 0) {
      this.rooms.delete(room.roomCode)

      return {
        roomCode: room.roomCode,
        roomStillExists: false,
      }
    }

    if (!room.players.some((player) => player.playerId === room.hostPlayerId)) {
      room.hostPlayerId = room.players[0].playerId
      room.players = room.players.map((player, index) => ({
        ...player,
        isHost: index === 0,
      }))
    }

    this.touchRoom(room)

    return {
      roomCode: room.roomCode,
      roomStillExists: true,
    }
  }

  private getPlayerBySocketId(room: LiveRoom, socketId: string): LivePlayer {
    const player = room.players.find((candidate) => candidate.socketId === socketId)

    if (!player) {
      throw new PlayerNotInRoomError(room.roomCode)
    }

    return player
  }

  private ensureRoomIsLobby(room: LiveRoom): void {
    if (room.status !== 'lobby') {
      throw new RoomNotInLobbyError(room.roomCode)
    }
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

  private buildRoomSnapshot(room: LiveRoom, currentPlayerId: string): RoomSnapshot {
    if (room.status === 'in_game') {
      return this.buildActiveRoundSnapshot(room, currentPlayerId)
    }

    return this.buildLobbySnapshot(room, currentPlayerId)
  }

  private buildLobbySnapshot(room: LiveRoom, currentPlayerId: string): LobbyRoomSnapshot {
    const currentPlayer = this.getCurrentPlayer(room, currentPlayerId)
    const minPlayersRequired = MIN_PLAYERS_BY_MODE[room.settings.mode]

    return {
      roomCode: room.roomCode,
      status: 'lobby',
      viewState: 'lobby',
      settings: room.settings,
      hostPlayerId: room.hostPlayerId,
      players: room.players.map((player) => this.toPlayerSummary(player, room.hostPlayerId)),
      currentPlayerId,
      minPlayersRequired,
      canCurrentPlayerStartMatch: currentPlayer.playerId === room.hostPlayerId && room.players.length >= minPlayersRequired,
      createdAt: room.createdAt,
      currentRoundNumber: 0,
      chatMessages: [],
    }
  }

  private buildActiveRoundSnapshot(room: LiveRoom, currentPlayerId: string): ActiveRoundRoomSnapshot {
    const currentPlayer = this.getCurrentPlayer(room, currentPlayerId)

    if (!room.activePvpRound) {
      throw new Error(`The room ${room.roomCode} does not have an active PVP round.`)
    }

    const scoreboard = this.buildInitialScoreboard(room.players)
    const timer = this.buildTimerState(room.activePvpRound)

    return {
      roomCode: room.roomCode,
      status: 'in_game',
      viewState: 'round_active',
      settings: room.settings,
      hostPlayerId: room.hostPlayerId,
      players: room.players.map((player) => this.toPlayerSummary(player, room.hostPlayerId)),
      currentPlayerId,
      minPlayersRequired: MIN_PLAYERS_BY_MODE[room.settings.mode],
      canCurrentPlayerStartMatch: false,
      createdAt: room.createdAt,
      currentRoundNumber: room.currentRoundNumber,
      totalRounds: room.settings.totalRounds,
      round: {
        mode: 'pvp',
        wordLength: room.activePvpRound.state.wordLength,
        submissionMode: room.settings.submissionMode,
        timer,
        scoreboard,
        players: room.activePvpRound.state.players.map((player) => ({ ...player })),
      },
      chatMessages: [],
    }
  }

  private buildInitialScoreboard(players: LivePlayer[]): ScoreEntry[] {
    return players.map((player) => ({
      playerId: player.playerId,
      nickname: player.nickname,
      totalPoints: 0,
      currentPlacement: null,
    }))
  }

  private buildTimerState(activeRound: LivePvpRound, now = new Date()): TimerState {
    if (activeRound.timerDurationSeconds === null || activeRound.timerEndsAt === null) {
      return {
        enabled: false,
        durationSeconds: null,
        remainingSeconds: null,
        startedAt: null,
        endsAt: null,
      }
    }

    const remainingSeconds = Math.max(
      Math.ceil((new Date(activeRound.timerEndsAt).getTime() - now.getTime()) / 1000),
      0,
    )

    return {
      enabled: true,
      durationSeconds: activeRound.timerDurationSeconds,
      remainingSeconds,
      startedAt: activeRound.state.startedAt,
      endsAt: activeRound.timerEndsAt,
    }
  }

  private getCurrentPlayer(room: LiveRoom, currentPlayerId: string): LivePlayer {
    const currentPlayer = room.players.find((player) => player.playerId === currentPlayerId)

    if (!currentPlayer) {
      throw new PlayerNotInRoomError(room.roomCode)
    }

    return currentPlayer
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
