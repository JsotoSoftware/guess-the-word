import type { GuessRecord, RoundOutcome } from '@guess-the-word/shared'
import { evaluateGuess } from './guess-evaluator'

export class RoundAlreadyCompletedError extends Error {
  constructor() {
    super('La ronda ya terminó y no acepta más jugadas.')
    this.name = 'RoundAlreadyCompletedError'
  }
}

export class PlayerNotFoundError extends Error {
  constructor(playerId: string) {
    super(`No se encontró el jugador ${playerId} en la ronda.`)
    this.name = 'PlayerNotFoundError'
  }
}

export class PlayerAlreadyFinishedError extends Error {
  constructor(playerId: string) {
    super(`El jugador ${playerId} ya terminó su participación en la ronda.`)
    this.name = 'PlayerAlreadyFinishedError'
  }
}

export interface RoundPlayerInput {
  playerId: string
  nickname: string
}

export interface PvpPlayerRoundState {
  playerId: string
  nickname: string
  attemptsLeft: number
  solved: boolean
  outOfAttempts: boolean
  finishPlacement: number | null
  finishedAt: string | null
  guessHistory: GuessRecord[]
}

export interface PvpRoundState {
  mode: 'pvp'
  secretWord: string
  wordLength: number
  status: 'active' | 'completed'
  startedAt: string
  completedAt: string | null
  players: PvpPlayerRoundState[]
}

export interface CoopRoundState {
  mode: 'coop'
  secretWord: string
  wordLength: number
  status: 'active' | RoundOutcome
  startedAt: string
  completedAt: string | null
  attemptsLeft: number
  totalAttempts: number
  guessHistory: GuessRecord[]
}

export class RoundStateService {
  createPvpRoundState(secretWord: string, players: RoundPlayerInput[], attemptsPerPlayer: number, startedAt = new Date().toISOString()): PvpRoundState {
    const normalizedSecretWord = this.normalizeWord(secretWord)

    return {
      mode: 'pvp',
      secretWord: normalizedSecretWord,
      wordLength: [...normalizedSecretWord].length,
      status: 'active',
      startedAt,
      completedAt: null,
      players: players.map((player) => ({
        playerId: player.playerId,
        nickname: player.nickname,
        attemptsLeft: attemptsPerPlayer,
        solved: false,
        outOfAttempts: false,
        finishPlacement: null,
        finishedAt: null,
        guessHistory: [],
      })),
    }
  }

  createCoopRoundState(secretWord: string, totalAttempts: number, startedAt = new Date().toISOString()): CoopRoundState {
    const normalizedSecretWord = this.normalizeWord(secretWord)

    return {
      mode: 'coop',
      secretWord: normalizedSecretWord,
      wordLength: [...normalizedSecretWord].length,
      status: 'active',
      startedAt,
      completedAt: null,
      attemptsLeft: totalAttempts,
      totalAttempts,
      guessHistory: [],
    }
  }

  applyPvpGuess(round: PvpRoundState, playerId: string, guess: string, submittedAt = new Date().toISOString()): PvpRoundState {
    this.ensurePvpRoundIsActive(round)

    const playerIndex = round.players.findIndex((player) => player.playerId === playerId)

    if (playerIndex === -1) {
      throw new PlayerNotFoundError(playerId)
    }

    const player = round.players[playerIndex]

    if (player.solved || player.outOfAttempts) {
      throw new PlayerAlreadyFinishedError(playerId)
    }

    const evaluation = evaluateGuess(round.secretWord, guess)
    const guessRecord: GuessRecord = {
      guess: evaluation.guess,
      result: evaluation.letters,
      submittedAt,
      submittedByPlayerId: playerId,
    }

    const updatedPlayer: PvpPlayerRoundState = {
      ...player,
      guessHistory: [...player.guessHistory, guessRecord],
    }

    if (evaluation.isCorrect) {
      updatedPlayer.solved = true
      updatedPlayer.finishedAt = submittedAt
      updatedPlayer.finishPlacement = this.getNextPlacement(round.players)
    } else {
      updatedPlayer.attemptsLeft -= 1
      if (updatedPlayer.attemptsLeft <= 0) {
        updatedPlayer.attemptsLeft = 0
        updatedPlayer.outOfAttempts = true
        updatedPlayer.finishedAt = submittedAt
      }
    }

    const updatedPlayers = round.players.map((existingPlayer, index) =>
      index === playerIndex ? updatedPlayer : existingPlayer,
    )

    const isRoundCompleted = updatedPlayers.every((existingPlayer) => existingPlayer.solved || existingPlayer.outOfAttempts)

    return {
      ...round,
      status: isRoundCompleted ? 'completed' : round.status,
      completedAt: isRoundCompleted ? submittedAt : round.completedAt,
      players: updatedPlayers,
    }
  }

  applyCoopGuess(round: CoopRoundState, guess: string, submittedByPlayerId: string, submittedAt = new Date().toISOString()): CoopRoundState {
    this.ensureCoopRoundIsActive(round)

    const evaluation = evaluateGuess(round.secretWord, guess)
    const guessRecord: GuessRecord = {
      guess: evaluation.guess,
      result: evaluation.letters,
      submittedAt,
      submittedByPlayerId,
    }

    const updatedRound: CoopRoundState = {
      ...round,
      guessHistory: [...round.guessHistory, guessRecord],
    }

    if (evaluation.isCorrect) {
      return {
        ...updatedRound,
        status: 'won',
        completedAt: submittedAt,
      }
    }

    const attemptsLeft = Math.max(updatedRound.attemptsLeft - 1, 0)
    const status: CoopRoundState['status'] = attemptsLeft === 0 ? 'lost' : 'active'

    return {
      ...updatedRound,
      attemptsLeft,
      status,
      completedAt: status === 'active' ? null : submittedAt,
    }
  }

  private normalizeWord(word: string): string {
    return word.trim().toLowerCase()
  }

  private ensurePvpRoundIsActive(round: PvpRoundState): void {
    if (round.status !== 'active') {
      throw new RoundAlreadyCompletedError()
    }
  }

  private ensureCoopRoundIsActive(round: CoopRoundState): void {
    if (round.status !== 'active') {
      throw new RoundAlreadyCompletedError()
    }
  }

  private getNextPlacement(players: PvpPlayerRoundState[]): number {
    const takenPlacements = players
      .map((player) => player.finishPlacement)
      .filter((placement): placement is number => placement !== null)

    return takenPlacements.length + 1
  }
}
