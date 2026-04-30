import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PlayerAlreadyFinishedError,
  RoundAlreadyCompletedError,
  RoundStateService,
} from './round-state.service'

const service = new RoundStateService()

test('crea una ronda PVP con el estado inicial esperado', () => {
  const round = service.createPvpRoundState(
    'queso',
    [
      { playerId: 'p1', nickname: 'Ana' },
      { playerId: 'p2', nickname: 'Luis' },
    ],
    5,
    '2026-01-01T00:00:00.000Z',
  )

  assert.equal(round.mode, 'pvp')
  assert.equal(round.status, 'active')
  assert.equal(round.wordLength, 5)
  assert.equal(round.players.length, 2)
  assert.equal(round.players[0].attemptsLeft, 5)
  assert.equal(round.players[0].guessHistory.length, 0)
})

test('descuenta intentos en PVP cuando la palabra es incorrecta', () => {
  const round = service.createPvpRoundState('queso', [{ playerId: 'p1', nickname: 'Ana' }], 2)
  const updatedRound = service.applyPvpGuess(round, 'p1', 'perro', '2026-01-01T00:01:00.000Z')

  assert.equal(updatedRound.players[0].attemptsLeft, 1)
  assert.equal(updatedRound.players[0].solved, false)
  assert.equal(updatedRound.players[0].guessHistory.length, 1)
})

test('marca solución y posición cuando un jugador acierta en PVP', () => {
  const round = service.createPvpRoundState(
    'queso',
    [
      { playerId: 'p1', nickname: 'Ana' },
      { playerId: 'p2', nickname: 'Luis' },
    ],
    3,
  )

  const afterFirstSolve = service.applyPvpGuess(round, 'p1', 'queso', '2026-01-01T00:02:00.000Z')
  const solvedPlayer = afterFirstSolve.players.find((player) => player.playerId === 'p1')

  assert.ok(solvedPlayer)
  assert.equal(solvedPlayer.solved, true)
  assert.equal(solvedPlayer.finishPlacement, 1)
  assert.equal(afterFirstSolve.status, 'active')
})

test('asigna placements PVP en orden de resolución y no cambia los ya asignados', () => {
  const round = service.createPvpRoundState(
    'queso',
    [
      { playerId: 'p1', nickname: 'Ana' },
      { playerId: 'p2', nickname: 'Luis' },
      { playerId: 'p3', nickname: 'Marta' },
      { playerId: 'p4', nickname: 'Pablo' },
    ],
    3,
  )

  const afterFirstSolve = service.applyPvpGuess(round, 'p2', 'queso', '2026-01-01T00:02:00.000Z')
  const afterSecondSolve = service.applyPvpGuess(afterFirstSolve, 'p4', 'queso', '2026-01-01T00:02:10.000Z')
  const afterThirdSolve = service.applyPvpGuess(afterSecondSolve, 'p1', 'queso', '2026-01-01T00:02:20.000Z')
  const afterFourthSolve = service.applyPvpGuess(afterThirdSolve, 'p3', 'queso', '2026-01-01T00:02:30.000Z')

  assert.equal(afterFourthSolve.players.find((player) => player.playerId === 'p2')?.finishPlacement, 1)
  assert.equal(afterFourthSolve.players.find((player) => player.playerId === 'p4')?.finishPlacement, 2)
  assert.equal(afterFourthSolve.players.find((player) => player.playerId === 'p1')?.finishPlacement, 3)
  assert.equal(afterFourthSolve.players.find((player) => player.playerId === 'p3')?.finishPlacement, 4)
})

test('cierra la ronda PVP cuando todos los jugadores terminaron', () => {
  const round = service.createPvpRoundState(
    'queso',
    [
      { playerId: 'p1', nickname: 'Ana' },
      { playerId: 'p2', nickname: 'Luis' },
    ],
    1,
  )

  const afterSolve = service.applyPvpGuess(round, 'p1', 'queso', '2026-01-01T00:03:00.000Z')
  const completedRound = service.applyPvpGuess(afterSolve, 'p2', 'perro', '2026-01-01T00:03:30.000Z')

  assert.equal(completedRound.status, 'completed')
  assert.equal(completedRound.completedAt, '2026-01-01T00:03:30.000Z')
  assert.equal(completedRound.players[1].outOfAttempts, true)
})

test('no permite seguir jugando una ronda PVP completada', () => {
  const round = service.createPvpRoundState('queso', [{ playerId: 'p1', nickname: 'Ana' }], 1)
  const completedRound = service.applyPvpGuess(round, 'p1', 'perro', '2026-01-01T00:04:00.000Z')

  assert.throws(() => service.applyPvpGuess(completedRound, 'p1', 'queso'), RoundAlreadyCompletedError)
})

test('crea una ronda cooperativa con intentos compartidos', () => {
  const round = service.createCoopRoundState('bosque', 4, '2026-01-01T00:05:00.000Z')

  assert.equal(round.mode, 'coop')
  assert.equal(round.status, 'active')
  assert.equal(round.attemptsLeft, 4)
  assert.equal(round.totalAttempts, 4)
  assert.equal(round.guessHistory.length, 0)
})

test('descuenta intentos compartidos en cooperativo y marca derrota al llegar a cero', () => {
  const round = service.createCoopRoundState('bosque', 1)
  const updatedRound = service.applyCoopGuess(round, 'frutas', 'p1', '2026-01-01T00:06:00.000Z')

  assert.equal(updatedRound.attemptsLeft, 0)
  assert.equal(updatedRound.status, 'lost')
  assert.equal(updatedRound.completedAt, '2026-01-01T00:06:00.000Z')
})

test('marca victoria cooperativa cuando el equipo acierta', () => {
  const round = service.createCoopRoundState('bosque', 3)
  const updatedRound = service.applyCoopGuess(round, 'bosque', 'p2', '2026-01-01T00:07:00.000Z')

  assert.equal(updatedRound.status, 'won')
  assert.equal(updatedRound.attemptsLeft, 3)
  assert.equal(updatedRound.guessHistory.length, 1)
})

test('no permite que un jugador PVP vuelva a jugar después de terminar', () => {
  const round = service.createPvpRoundState('queso', [{ playerId: 'p1', nickname: 'Ana' }], 1)
  const completedRound = service.applyPvpGuess(round, 'p1', 'queso', '2026-01-01T00:08:00.000Z')

  assert.throws(() => service.applyPvpGuess({ ...completedRound, status: 'active', completedAt: null }, 'p1', 'queso'), PlayerAlreadyFinishedError)
})
