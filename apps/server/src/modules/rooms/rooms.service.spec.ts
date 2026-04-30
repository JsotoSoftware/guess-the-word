import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_ROOM_SETTINGS } from '@guess-the-word/shared'
import {
  GuessAlreadySubmittedError,
  InvalidGuessLengthAppError,
  NotHostError,
  RoomNotFoundError,
  RoomsService,
  StartNotAllowedError,
} from './rooms.service'

function createServiceWithWord(word = 'queso') {
  return new RoomsService({
    async getRandomSecretWord() {
      return {
        id: 'word-1',
        word,
        language: 'spanish',
        difficulty: null,
        category: null,
        length: word.length,
        is_active: true,
        created_at: '2026-01-01T00:00:00.000Z',
      }
    },
  } as never)
}

test('genera códigos de sala únicos en un uso normal', () => {
  const service = new RoomsService()
  const roomCodes = new Set<string>()

  for (let index = 0; index < 250; index += 1) {
    const response = service.createRoom({
      nickname: `Host ${index}`,
      settings: DEFAULT_ROOM_SETTINGS,
      socketId: `socket-${index}`,
    })

    assert.equal(roomCodes.has(response.room.roomCode), false)
    roomCodes.add(response.room.roomCode)
  }
})

test('crear una sala devuelve el host y conserva la configuración elegida', () => {
  const service = new RoomsService()
  const response = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      submissionMode: 'manual_submit',
      pvpTimerSeconds: 90,
      maxPlayers: 6,
    },
    socketId: 'socket-host',
  })

  assert.equal(response.room.players.length, 1)
  assert.equal(response.room.players[0].isHost, true)
  assert.equal(response.room.hostPlayerId, response.playerId)
  assert.equal(response.room.settings.submissionMode, 'manual_submit')
  assert.equal(response.room.settings.pvpTimerSeconds, 90)
  assert.equal(response.room.settings.maxPlayers, 6)
})

test('permite que otro cliente se una a una sala válida', () => {
  const service = new RoomsService()
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-host',
  })

  const joinedRoom = service.joinRoom({
    roomCode: createdRoom.room.roomCode,
    nickname: 'Luis',
    socketId: 'socket-guest',
  })

  assert.equal(joinedRoom.room.roomCode, createdRoom.room.roomCode)
  assert.equal(joinedRoom.room.players.length, 2)
  assert.equal(joinedRoom.room.players.some((player) => player.nickname === 'Luis'), true)
  assert.equal(joinedRoom.room.players.find((player) => player.nickname === 'Ana')?.isHost, true)
  assert.equal(joinedRoom.room.players.find((player) => player.nickname === 'Luis')?.isHost, false)
})

test('rechaza unirse a una sala inexistente', () => {
  const service = new RoomsService()

  assert.throws(
    () => service.joinRoom({ roomCode: 'XXXXXX', nickname: 'Luis', socketId: 'socket-guest' }),
    RoomNotFoundError,
  )
})

test('rechaza unirse a una sala cerrada', () => {
  const service = new RoomsService()
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-host',
  })

  service.closeRoom({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  assert.throws(
    () => service.joinRoom({ roomCode: createdRoom.room.roomCode, nickname: 'Luis', socketId: 'socket-guest' }),
    RoomNotFoundError,
  )
})

test('el host puede cerrar la sala y se elimina de la memoria activa', () => {
  const service = new RoomsService()
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-host',
  })

  const response = service.closeRoom({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  assert.equal(response.roomCode, createdRoom.room.roomCode)
  assert.equal(service.hasRoom(createdRoom.room.roomCode), false)
})

test('sincroniza cambios de configuración para todos los jugadores del lobby', () => {
  const service = new RoomsService()
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-host',
  })

  service.joinRoom({
    roomCode: createdRoom.room.roomCode,
    nickname: 'Luis',
    socketId: 'socket-guest',
  })

  service.updateRoomSettings({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'coop',
      submissionMode: 'manual_submit',
      pvpTimerSeconds: 120,
      maxPlayers: 5,
    },
  })

  const targets = service.getRoomStateTargets(createdRoom.room.roomCode)

  assert.equal(targets.length, 2)
  assert.equal(targets.every((target) => target.room.viewState === 'lobby'), true)
  assert.equal(targets.every((target) => target.room.settings.mode === 'coop'), true)
  assert.equal(targets.every((target) => target.room.settings.submissionMode === 'manual_submit'), true)
  assert.equal(targets.every((target) => target.room.settings.pvpTimerSeconds === null), true)
})

test('solo el host puede cambiar la configuración del lobby', () => {
  const service = new RoomsService()
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-host',
  })

  service.joinRoom({
    roomCode: createdRoom.room.roomCode,
    nickname: 'Luis',
    socketId: 'socket-guest',
  })

  assert.throws(
    () => service.updateRoomSettings({
      roomCode: createdRoom.room.roomCode,
      socketId: 'socket-guest',
      settings: {
        ...DEFAULT_ROOM_SETTINGS,
        submissionMode: 'manual_submit',
      },
    }),
    NotHostError,
  )
})

test('la salida de un jugador actualiza la lista y transfiere el host si hace falta', () => {
  const service = new RoomsService()
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-host',
  })

  service.joinRoom({
    roomCode: createdRoom.room.roomCode,
    nickname: 'Luis',
    socketId: 'socket-guest-1',
  })

  service.joinRoom({
    roomCode: createdRoom.room.roomCode,
    nickname: 'Marta',
    socketId: 'socket-guest-2',
  })

  service.leaveRoom({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  const targets = service.getRoomStateTargets(createdRoom.room.roomCode)

  assert.equal(targets.length, 2)
  assert.equal(targets.every((target) => target.room.players.length === 2), true)
  assert.equal(targets.every((target) => target.room.hostPlayerId === targets[0].room.players[0].playerId), true)
  assert.equal(targets[0].room.players[0].isHost, true)
})

test('la limpieza por inactividad cierra salas de lobby abandonadas', () => {
  const service = new RoomsService()
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-host',
  })

  const closedRooms = service.closeIdleRooms(new Date('2030-01-01T00:10:00.000Z'))

  assert.equal(closedRooms.length, 1)
  assert.equal(closedRooms[0].roomCode, createdRoom.room.roomCode)
  assert.equal(service.hasRoom(createdRoom.room.roomCode), false)
})

test('en PVP el host no puede iniciar con menos de 2 jugadores', () => {
  const service = new RoomsService()
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
    },
    socketId: 'socket-host',
  })

  assert.equal(createdRoom.room.minPlayersRequired, 2)
  assert.equal(createdRoom.room.canCurrentPlayerStartMatch, false)
})

test('en cooperativo el host sí puede iniciar con un solo jugador', () => {
  const service = new RoomsService()
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'coop',
      pvpTimerSeconds: null,
    },
    socketId: 'socket-host',
  })

  assert.equal(createdRoom.room.minPlayersRequired, 1)
  assert.equal(createdRoom.room.canCurrentPlayerStartMatch, true)
})

test('al iniciar una ronda PVP se elige una palabra y todos entran a la misma ronda activa', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      pvpTimerSeconds: 90,
    },
    socketId: 'socket-host',
  })

  service.joinRoom({
    roomCode: createdRoom.room.roomCode,
    nickname: 'Luis',
    socketId: 'socket-guest',
  })

  const response = await service.startMatch({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  assert.equal(response.room.viewState, 'round_active')
  assert.equal(response.room.round.mode, 'pvp')
  assert.equal(response.room.round.wordLength, 5)
  assert.equal(response.room.currentRoundNumber, 1)
})

test('cada jugador recibe intentos independientes al comenzar la ronda PVP', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      attemptsPerRound: 7,
      pvpTimerSeconds: null,
    },
    socketId: 'socket-host',
  })

  service.joinRoom({
    roomCode: createdRoom.room.roomCode,
    nickname: 'Luis',
    socketId: 'socket-guest',
  })

  const response = await service.startMatch({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  assert.equal(response.room.round.mode, 'pvp')
  assert.equal(response.room.round.players.length, 2)
  assert.equal(response.room.round.players.every((player) => player.attemptsLeft === 7), true)
})

test('la ronda PVP incluye temporizador sincronizado cuando está habilitado', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      pvpTimerSeconds: 120,
    },
    socketId: 'socket-host',
  })

  service.joinRoom({
    roomCode: createdRoom.room.roomCode,
    nickname: 'Luis',
    socketId: 'socket-guest',
  })

  const response = await service.startMatch({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  assert.equal(response.room.round.mode, 'pvp')
  assert.equal(response.room.round.timer.enabled, true)
  assert.equal(response.room.round.timer.durationSeconds, 120)
  assert.ok(response.room.round.timer.startedAt)
  assert.ok(response.room.round.timer.endsAt)
})

test('la ronda PVP no crea temporizador cuando está deshabilitado y conserva el modo de envío', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      submissionMode: 'manual_submit',
      pvpTimerSeconds: null,
    },
    socketId: 'socket-host',
  })

  service.joinRoom({
    roomCode: createdRoom.room.roomCode,
    nickname: 'Luis',
    socketId: 'socket-guest',
  })

  const response = await service.startMatch({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  assert.equal(response.room.round.mode, 'pvp')
  assert.equal(response.room.round.timer.enabled, false)
  assert.equal(response.room.round.timer.durationSeconds, null)
  assert.equal(response.room.round.submissionMode, 'manual_submit')
})

test('un guess PVP solo consume intentos del jugador que lo envía y mantiene el historial aislado', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      attemptsPerRound: 3,
    },
    socketId: 'socket-host',
  })

  service.joinRoom({
    roomCode: createdRoom.room.roomCode,
    nickname: 'Luis',
    socketId: 'socket-guest',
  })

  await service.startMatch({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  service.submitGuess({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
    guess: 'perro',
  })

  const hostSnapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0].room

  if (hostSnapshot.viewState !== 'round_active' || hostSnapshot.round.mode !== 'pvp') {
    throw new Error('Expected an active PVP round snapshot.')
  }

  const hostPlayer = hostSnapshot.round.players.find((player) => player.nickname === 'Ana')
  const guestPlayer = hostSnapshot.round.players.find((player) => player.nickname === 'Luis')

  assert.ok(hostPlayer)
  assert.ok(guestPlayer)
  assert.equal(hostPlayer.attemptsLeft, 2)
  assert.equal(guestPlayer.attemptsLeft, 3)
  assert.equal(hostPlayer.guessHistory.length, 1)
  assert.equal(guestPlayer.guessHistory.length, 0)
})

test('rechaza guesses de longitud inválida sin corromper el estado de la ronda', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      attemptsPerRound: 3,
    },
    socketId: 'socket-host',
  })

  service.joinRoom({
    roomCode: createdRoom.room.roomCode,
    nickname: 'Luis',
    socketId: 'socket-guest',
  })

  await service.startMatch({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  assert.throws(
    () => service.submitGuess({
      roomCode: createdRoom.room.roomCode,
      socketId: 'socket-host',
      guess: 'sol',
    }),
    InvalidGuessLengthAppError,
  )

  const hostSnapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0].room

  if (hostSnapshot.viewState !== 'round_active' || hostSnapshot.round.mode !== 'pvp') {
    throw new Error('Expected an active PVP round snapshot.')
  }

  const hostPlayer = hostSnapshot.round.players.find((player) => player.nickname === 'Ana')

  assert.ok(hostPlayer)
  assert.equal(hostPlayer.attemptsLeft, 3)
  assert.equal(hostPlayer.guessHistory.length, 0)
})

test('rechaza guesses duplicados del mismo jugador sin consumir intentos adicionales', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      attemptsPerRound: 3,
    },
    socketId: 'socket-host',
  })

  service.joinRoom({
    roomCode: createdRoom.room.roomCode,
    nickname: 'Luis',
    socketId: 'socket-guest',
  })

  await service.startMatch({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  service.submitGuess({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
    guess: 'perro',
  })

  assert.throws(
    () => service.submitGuess({
      roomCode: createdRoom.room.roomCode,
      socketId: 'socket-host',
      guess: 'perro',
    }),
    GuessAlreadySubmittedError,
  )

  const hostSnapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0].room

  if (hostSnapshot.viewState !== 'round_active' || hostSnapshot.round.mode !== 'pvp') {
    throw new Error('Expected an active PVP round snapshot.')
  }

  const hostPlayer = hostSnapshot.round.players.find((player) => player.nickname === 'Ana')

  assert.ok(hostPlayer)
  assert.equal(hostPlayer.attemptsLeft, 2)
  assert.equal(hostPlayer.guessHistory.length, 1)
})

test('el inicio PVP real sigue bloqueado si faltan jugadores', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
    },
    socketId: 'socket-host',
  })

  await assert.rejects(
    () => service.startMatch({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' }),
    StartNotAllowedError,
  )
})

test('cerrar la pestaña elimina al jugador de la sala igual que salir manualmente', () => {
  const service = new RoomsService()
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-host',
  })

  service.joinRoom({
    roomCode: createdRoom.room.roomCode,
    nickname: 'Luis',
    socketId: 'socket-guest',
  })

  const disconnectResult = service.disconnectSocket('socket-guest')
  const targets = service.getRoomStateTargets(createdRoom.room.roomCode)

  assert.ok(disconnectResult)
  assert.equal(disconnectResult.roomStillExists, true)
  assert.equal(targets.length, 1)
  assert.equal(targets[0].room.players.length, 1)
  assert.equal(targets[0].room.players[0].nickname, 'Ana')
})

test('si el socket desconectado era el host, la sala transfiere el host restante', () => {
  const service = new RoomsService()
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-host',
  })

  service.joinRoom({
    roomCode: createdRoom.room.roomCode,
    nickname: 'Luis',
    socketId: 'socket-guest',
  })

  const disconnectResult = service.disconnectSocket('socket-host')
  const targets = service.getRoomStateTargets(createdRoom.room.roomCode)

  assert.ok(disconnectResult)
  assert.equal(disconnectResult.roomStillExists, true)
  assert.equal(targets.length, 1)
  assert.equal(targets[0].room.hostPlayerId, targets[0].room.players[0].playerId)
  assert.equal(targets[0].room.players[0].nickname, 'Luis')
  assert.equal(targets[0].room.players[0].isHost, true)
})

test('si se cierra la última pestaña, la sala se elimina', () => {
  const service = new RoomsService()
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-host',
  })

  const disconnectResult = service.disconnectSocket('socket-host')

  assert.ok(disconnectResult)
  assert.equal(disconnectResult.roomStillExists, false)
  assert.equal(service.hasRoom(createdRoom.room.roomCode), false)
})
