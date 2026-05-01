import { Injectable } from '@nestjs/common'
import {
  DEFAULT_ROUND_SUMMARY_AUTO_ADVANCE_SECONDS,
  MIN_PLAYERS_BY_MODE,
  PVP_BASE_POINTS,
  PVP_PLACEMENT_BONUSES,
  ROOM_CODE_LENGTH,
  type ActiveRoundRoomSnapshot,
  type ChatMessage,
  type CloseRoomResponse,
  type CreateRoomResponse,
  type GameMode,
  type JoinRoomResponse,
  type LeaveRoomResponse,
  type LobbyRoomSnapshot,
  type PvpRoundPlacement,
  type PlayerConnectionState,
  type PlayerSummary,
  type RoomClosedEvent,
  type RoomSettings,
  type RoomSnapshot,
  type RoomStatus,
  type SendChatMessageResponse,
  type RoundSummaryRoomSnapshot,
  type ScoreEntry,
  type StartMatchResponse,
  type SubmitGuessResponse,
  type TimerState,
  type UpdateRoomSettingsResponse,
} from '@guess-the-word/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import {
  PlayerAlreadyFinishedError,
  RoundAlreadyCompletedError,
  RoundStateService,
  type CoopRoundState as EngineCoopRoundState,
  type PvpRoundState as EnginePvpRoundState,
} from '../game/round-state.service'
import { InvalidGuessLengthError } from '../game/guess-evaluator'
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

export class GuessAlreadySubmittedError extends RoomActionError {
  constructor(guess: string) {
    super('GUESS_ALREADY_SUBMITTED', `La palabra ${guess.toUpperCase()} ya fue enviada en la ronda actual.`, { guess })
  }
}

export class RoundNotActiveError extends RoomActionError {
  constructor() {
    super('ROUND_NOT_ACTIVE', 'La ronda actual ya no acepta más jugadas.')
  }
}

export class InvalidGuessLengthAppError extends RoomActionError {
  constructor(expectedLength: number, receivedLength: number) {
    super(
      'INVALID_GUESS_LENGTH',
      `La palabra enviada debe tener ${expectedLength} letras, pero recibió ${receivedLength}.`,
      { expectedLength, receivedLength },
    )
  }
}

export class InvalidChatMessageError extends RoomActionError {
  constructor() {
    super('INVALID_CHAT_MESSAGE', 'Debes escribir un mensaje antes de enviarlo.')
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
  scoreboard: ScoreEntry[]
  roundsWon: number
  roundsLost: number
  createdAt: string
  lastActivityAt: string
  currentRoundNumber: number
  activePvpRound: LivePvpRound | null
  activeCoopRound: EngineCoopRoundState | null
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

interface SubmitGuessInput {
  roomCode: string
  socketId: string
  guess: string
}

interface SendChatInput {
  roomCode: string
  socketId: string
  text: string
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
  private readonly roomChatMessages = new Map<string, ChatMessage[]>()
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
      scoreboard: [
        {
          playerId: hostPlayer.playerId,
          nickname: hostPlayer.nickname,
          totalPoints: 0,
          currentPlacement: null,
        },
      ],
      roundsWon: 0,
      roundsLost: 0,
      createdAt,
      lastActivityAt: createdAt,
      currentRoundNumber: 0,
      activePvpRound: null,
      activeCoopRound: null,
    }

    this.rooms.set(roomCode, room)
    this.roomChatMessages.set(roomCode, [])

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
    room.scoreboard.push({
      playerId: player.playerId,
      nickname: player.nickname,
      totalPoints: 0,
      currentPlacement: null,
    })
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

    if (!this.wordsService) {
      throw new Error('WordsService is not available.')
    }

    const secretWord = await this.wordsService.getRandomSecretWord({})
    const startedAt = new Date().toISOString()

    room.status = 'in_game'
    room.currentRoundNumber = 1

    if (room.settings.mode === 'pvp') {
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

      room.activePvpRound = {
        state: roundState,
        timerDurationSeconds,
        timerEndsAt,
      }
      room.activeCoopRound = null
    } else {
      room.activePvpRound = null
      room.activeCoopRound = this.roundStateService.createCoopRoundState(
        secretWord.word,
        room.settings.attemptsPerRound,
        startedAt,
      )
    }

    this.touchRoom(room)

    return {
      room: this.buildActiveRoundSnapshot(room, player.playerId),
    }
  }

  submitGuess(input: SubmitGuessInput): SubmitGuessResponse {
    const room = this.getRoomOrThrow(input.roomCode)

    if (room.status !== 'in_game' || (!room.activePvpRound && !room.activeCoopRound)) {
      throw new RoundNotActiveError()
    }

    const player = this.getPlayerBySocketId(room, input.socketId)
    const normalizedGuess = input.guess.trim().toLowerCase()

    if (room.activeCoopRound) {
      if (room.activeCoopRound.guessHistory.some((guessRecord) => guessRecord.guess === normalizedGuess)) {
        throw new GuessAlreadySubmittedError(normalizedGuess)
      }

      try {
        const previousRoundState = room.activeCoopRound
        const nextRoundState = this.roundStateService.applyCoopGuess(
          room.activeCoopRound,
          normalizedGuess,
          player.playerId,
        )

        room.activeCoopRound = nextRoundState
        this.applyCoopRoundOutcomeUpdate(room, previousRoundState, nextRoundState)
        this.touchRoom(room)

        return {
          accepted: true,
        }
      } catch (error) {
        if (error instanceof InvalidGuessLengthError) {
          throw new InvalidGuessLengthAppError(room.activeCoopRound.wordLength, normalizedGuess.length)
        }

        if (error instanceof RoundAlreadyCompletedError) {
          throw new RoundNotActiveError()
        }

        throw error
      }
    }

    this.expirePvpTimerIfNeeded(room)

    if (!room.activePvpRound || room.activePvpRound.state.status !== 'active') {
      throw new RoundNotActiveError()
    }

    if (
      room.activePvpRound.state.players
        .find((roundPlayer) => roundPlayer.playerId === player.playerId)
        ?.guessHistory.some((guessRecord) => guessRecord.guess === normalizedGuess)
    ) {
      throw new GuessAlreadySubmittedError(normalizedGuess)
    }

    try {
      const previousRoundState = room.activePvpRound.state
      const nextRoundState = this.roundStateService.applyPvpGuess(
        previousRoundState,
        player.playerId,
        normalizedGuess,
      )

      room.activePvpRound.state = nextRoundState
      this.applyPvpScoreUpdates(room, previousRoundState, nextRoundState)
      this.touchRoom(room)

      return {
        accepted: true,
      }
    } catch (error) {
      if (error instanceof InvalidGuessLengthError) {
        throw new InvalidGuessLengthAppError(room.activePvpRound.state.wordLength, normalizedGuess.length)
      }

      if (error instanceof RoundAlreadyCompletedError || error instanceof PlayerAlreadyFinishedError) {
        throw new RoundNotActiveError()
      }

      throw error
    }
  }

  sendChatMessage(input: SendChatInput): SendChatMessageResponse {
    const room = this.getRoomOrThrow(input.roomCode)
    const player = this.getPlayerBySocketId(room, input.socketId)
    const text = this.normalizeChatText(input.text)

    const message: ChatMessage = {
      messageId: randomUUID(),
      roomCode: room.roomCode,
      scope: 'room',
      senderPlayerId: player.playerId,
      senderNickname: player.nickname,
      text,
      sentAt: new Date().toISOString(),
    }

    this.getRoomChatMessages(room.roomCode).push(message)
    this.touchRoom(room)

    return {
      message,
    }
  }

  closeRoom(input: CloseRoomInput): CloseRoomResponse {
    const room = this.getRoomOrThrow(input.roomCode)
    const player = this.getPlayerBySocketId(room, input.socketId)

    if (player.playerId !== room.hostPlayerId) {
      throw new NotHostError()
    }

    room.status = 'closed'
    this.deleteRoom(room.roomCode)

    return {
      roomCode: room.roomCode,
      closedAt: new Date().toISOString(),
    }
  }

  expireElapsedPvpRounds(now = new Date()): string[] {
    const updatedRoomCodes: string[] = []

    for (const room of this.rooms.values()) {
      if (this.expirePvpTimerIfNeeded(room, now)) {
        updatedRoomCodes.push(room.roomCode)
      }
    }

    return updatedRoomCodes
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
      this.deleteRoom(room.roomCode)
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

  private deleteRoom(roomCode: string): void {
    this.rooms.delete(roomCode)
    this.roomChatMessages.delete(roomCode)
  }

  private getRoomChatMessages(roomCode: string): ChatMessage[] {
    const existingMessages = this.roomChatMessages.get(roomCode)

    if (existingMessages) {
      return existingMessages
    }

    const nextMessages: ChatMessage[] = []
    this.roomChatMessages.set(roomCode, nextMessages)
    return nextMessages
  }

  private buildChatMessagesSnapshot(roomCode: string): ChatMessage[] {
    return this.getRoomChatMessages(roomCode).map((message) => ({ ...message }))
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

    room.scoreboard = room.scoreboard.filter((scoreEntry) => scoreEntry.playerId !== removedPlayer.playerId)

    if (room.activePvpRound) {
      room.activePvpRound.state = {
        ...room.activePvpRound.state,
        players: room.activePvpRound.state.players.filter((player) => player.playerId !== removedPlayer.playerId),
      }
    }

    if (room.players.length === 0) {
      this.deleteRoom(room.roomCode)

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
      this.expirePvpTimerIfNeeded(room)

      if (room.activePvpRound?.state.status === 'completed') {
        return this.buildRoundSummarySnapshot(room, currentPlayerId)
      }

      if (room.activeCoopRound && room.activeCoopRound.status !== 'active') {
        return this.buildCoopRoundSummarySnapshot(room, currentPlayerId)
      }

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
      chatMessages: this.buildChatMessagesSnapshot(room.roomCode),
    }
  }

  private buildActiveRoundSnapshot(room: LiveRoom, currentPlayerId: string): ActiveRoundRoomSnapshot {
    const currentPlayer = this.getCurrentPlayer(room, currentPlayerId)

    if (room.activePvpRound) {
      const scoreboard = this.buildScoreboard(room)
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
        chatMessages: this.buildChatMessagesSnapshot(room.roomCode),
      }
    }

    if (room.activeCoopRound) {
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
          mode: 'coop',
          wordLength: room.activeCoopRound.wordLength,
          submissionMode: room.settings.submissionMode,
          status: room.activeCoopRound.status,
          attemptsLeft: room.activeCoopRound.attemptsLeft,
          totalAttempts: room.activeCoopRound.totalAttempts,
          roundsWon: room.roundsWon,
          roundsLost: room.roundsLost,
          guessHistory: room.activeCoopRound.guessHistory.map((guessRecord) => ({ ...guessRecord })),
        },
        chatMessages: this.buildChatMessagesSnapshot(room.roomCode),
      }
    }

    throw new Error(`The room ${room.roomCode} does not have an active round.`)
  }

  private buildRoundSummarySnapshot(room: LiveRoom, currentPlayerId: string): RoundSummaryRoomSnapshot {
    const currentPlayer = this.getCurrentPlayer(room, currentPlayerId)

    if (!room.activePvpRound || room.activePvpRound.state.status !== 'completed' || !room.activePvpRound.state.completedAt) {
      throw new Error(`The room ${room.roomCode} does not have a completed PVP round.`)
    }

    const scoreboard = this.buildScoreboard(room)
    const timer = this.buildCompletedTimerState(room.activePvpRound)
    const placements = this.buildPvpRoundPlacements(room, scoreboard)
    const summaryAutoAdvanceAt = new Date(
      Date.parse(room.activePvpRound.state.completedAt) + room.settings.roundSummaryAutoAdvanceSeconds * 1000,
    ).toISOString()

    return {
      roomCode: room.roomCode,
      status: 'in_game',
      viewState: 'round_summary',
      settings: room.settings,
      hostPlayerId: room.hostPlayerId,
      players: room.players.map((player) => this.toPlayerSummary(player, room.hostPlayerId)),
      currentPlayerId,
      minPlayersRequired: MIN_PLAYERS_BY_MODE[room.settings.mode],
      canCurrentPlayerStartMatch: false,
      createdAt: room.createdAt,
      currentRoundNumber: room.currentRoundNumber,
      totalRounds: room.settings.totalRounds,
      summary: {
        mode: 'pvp',
        secretWord: room.activePvpRound.state.secretWord,
        timer,
        placements,
        scoreboard,
      },
      canCurrentPlayerAdvanceSummary: currentPlayer.playerId === room.hostPlayerId,
      summaryAutoAdvanceAt,
      chatMessages: this.buildChatMessagesSnapshot(room.roomCode),
    }
  }

  private buildCoopRoundSummarySnapshot(room: LiveRoom, currentPlayerId: string): RoundSummaryRoomSnapshot {
    const currentPlayer = this.getCurrentPlayer(room, currentPlayerId)

    if (!room.activeCoopRound || room.activeCoopRound.status === 'active' || !room.activeCoopRound.completedAt) {
      throw new Error(`The room ${room.roomCode} does not have a completed Co-op round.`)
    }

    const summaryAutoAdvanceAt = new Date(
      Date.parse(room.activeCoopRound.completedAt) + room.settings.roundSummaryAutoAdvanceSeconds * 1000,
    ).toISOString()

    return {
      roomCode: room.roomCode,
      status: 'in_game',
      viewState: 'round_summary',
      settings: room.settings,
      hostPlayerId: room.hostPlayerId,
      players: room.players.map((player) => this.toPlayerSummary(player, room.hostPlayerId)),
      currentPlayerId,
      minPlayersRequired: MIN_PLAYERS_BY_MODE[room.settings.mode],
      canCurrentPlayerStartMatch: false,
      createdAt: room.createdAt,
      currentRoundNumber: room.currentRoundNumber,
      totalRounds: room.settings.totalRounds,
      summary: {
        mode: 'coop',
        secretWord: room.activeCoopRound.secretWord,
        outcome: room.activeCoopRound.status,
        attemptsLeft: room.activeCoopRound.attemptsLeft,
        roundsWon: room.roundsWon,
        roundsLost: room.roundsLost,
      },
      canCurrentPlayerAdvanceSummary: currentPlayer.playerId === room.hostPlayerId,
      summaryAutoAdvanceAt,
      chatMessages: this.buildChatMessagesSnapshot(room.roomCode),
    }
  }

  private buildScoreboard(room: LiveRoom): ScoreEntry[] {
    const placementsByPlayerId = new Map(
      room.activePvpRound?.state.players.map((player) => [player.playerId, player.finishPlacement]) ?? [],
    )

    return room.scoreboard
      .map((entry) => ({
        ...entry,
        currentPlacement: placementsByPlayerId.get(entry.playerId) ?? null,
      }))
      .sort((left, right) => {
        if (right.totalPoints !== left.totalPoints) {
          return right.totalPoints - left.totalPoints
        }

        if (left.currentPlacement !== null && right.currentPlacement !== null) {
          return left.currentPlacement - right.currentPlacement
        }

        if (left.currentPlacement !== null) {
          return -1
        }

        if (right.currentPlacement !== null) {
          return 1
        }

        return left.nickname.localeCompare(right.nickname)
      })
  }

  private buildPvpRoundPlacements(room: LiveRoom, scoreboard: ScoreEntry[]): PvpRoundPlacement[] {
    if (!room.activePvpRound) {
      return []
    }

    const scoresByPlayerId = new Map(scoreboard.map((entry) => [entry.playerId, entry]))

    return room.activePvpRound.state.players
      .map((player) => ({
        playerId: player.playerId,
        nickname: player.nickname,
        placement: player.finishPlacement,
        solved: player.solved,
        roundPoints: player.solved && player.finishPlacement !== null
          ? this.calculatePvpRoundPoints(player.finishPlacement)
          : 0,
        totalPoints: scoresByPlayerId.get(player.playerId)?.totalPoints ?? 0,
      }))
      .sort((left, right) => {
        if (left.placement !== null && right.placement !== null) {
          return left.placement - right.placement
        }

        if (left.placement !== null) {
          return -1
        }

        if (right.placement !== null) {
          return 1
        }

        return left.nickname.localeCompare(right.nickname)
      })
  }

  private applyPvpScoreUpdates(
    room: LiveRoom,
    previousRoundState: EnginePvpRoundState,
    nextRoundState: EnginePvpRoundState,
  ): void {
    for (const updatedPlayer of nextRoundState.players) {
      const previousPlayer = previousRoundState.players.find((player) => player.playerId === updatedPlayer.playerId)

      if (!previousPlayer || previousPlayer.solved || !updatedPlayer.solved || updatedPlayer.finishPlacement === null) {
        continue
      }

      const scoreEntry = room.scoreboard.find((entry) => entry.playerId === updatedPlayer.playerId)

      if (!scoreEntry) {
        continue
      }

      scoreEntry.totalPoints += this.calculatePvpRoundPoints(updatedPlayer.finishPlacement)
    }
  }

  private calculatePvpRoundPoints(finishPlacement: number): number {
    return PVP_BASE_POINTS + (PVP_PLACEMENT_BONUSES[finishPlacement] ?? 0)
  }

  private applyCoopRoundOutcomeUpdate(
    room: LiveRoom,
    previousRoundState: EngineCoopRoundState,
    nextRoundState: EngineCoopRoundState,
  ): void {
    if (previousRoundState.status !== 'active' || nextRoundState.status === 'active') {
      return
    }

    if (nextRoundState.status === 'won') {
      room.roundsWon += 1
      return
    }

    room.roundsLost += 1
  }

  private expirePvpTimerIfNeeded(room: LiveRoom, now = new Date()): boolean {
    if (
      room.status !== 'in_game'
      || !room.activePvpRound
      || room.activePvpRound.state.status !== 'active'
      || room.activePvpRound.timerEndsAt === null
    ) {
      return false
    }

    if (new Date(room.activePvpRound.timerEndsAt).getTime() > now.getTime()) {
      return false
    }

    room.activePvpRound.state = this.roundStateService.completePvpRound(room.activePvpRound.state, now.toISOString())
    this.touchRoom(room)
    return true
  }

  private buildCompletedTimerState(activeRound: LivePvpRound): TimerState {
    const completedAt = activeRound.state.completedAt

    if (completedAt) {
      return this.buildTimerState(activeRound, new Date(completedAt))
    }

    return this.buildTimerState(activeRound)
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

  private normalizeChatText(text: string): string {
    const normalizedText = text.trim()

    if (!normalizedText) {
      throw new InvalidChatMessageError()
    }

    return normalizedText.slice(0, 300)
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
