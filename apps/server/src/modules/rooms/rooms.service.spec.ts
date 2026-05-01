import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_ROOM_SETTINGS, PVP_BASE_POINTS, PVP_PLACEMENT_BONUSES } from '@guess-the-word/shared'
import {
  GuessAlreadySubmittedError,
  InvalidGuessLengthAppError,
  NotHostError,
  ReconnectExpiredError,
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

function forceGeneratedRoomCode(service: RoomsService, roomCode: string) {
  ;(service as unknown as { generateRoomCode: () => string }).generateRoomCode = () => roomCode
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

test('el host puede cerrar la sala desde una ronda activa', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      totalRounds: 2,
      attemptsPerRound: 2,
      pvpTimerSeconds: null,
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

  const response = service.closeRoom({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  assert.equal(response.roomCode, createdRoom.room.roomCode)
  assert.equal(service.hasRoom(createdRoom.room.roomCode), false)
})

test('el host puede cerrar la sala desde el summary de ronda', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      totalRounds: 2,
      attemptsPerRound: 1,
      pvpTimerSeconds: null,
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

  service.submitGuess({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host', guess: 'queso' })
  service.submitGuess({ roomCode: createdRoom.room.roomCode, socketId: 'socket-guest', guess: 'perro' })

  const snapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0]?.room
  assert.equal(snapshot?.viewState, 'round_summary')

  const response = service.closeRoom({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  assert.equal(response.roomCode, createdRoom.room.roomCode)
  assert.equal(service.hasRoom(createdRoom.room.roomCode), false)
})

test('el host puede cerrar la sala desde resultados finales', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      totalRounds: 1,
      attemptsPerRound: 1,
      pvpTimerSeconds: null,
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

  service.submitGuess({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host', guess: 'queso' })
  service.submitGuess({ roomCode: createdRoom.room.roomCode, socketId: 'socket-guest', guess: 'perro' })
  await service.continueRound({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })

  const finalSnapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0]?.room
  assert.equal(finalSnapshot?.viewState, 'final_results')

  const response = service.closeRoom({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  assert.equal(response.roomCode, createdRoom.room.roomCode)
  assert.equal(service.hasRoom(createdRoom.room.roomCode), false)
})

test('después de una revancha el host todavía puede cerrar la sala', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      totalRounds: 1,
      attemptsPerRound: 1,
      pvpTimerSeconds: null,
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

  service.submitGuess({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host', guess: 'queso' })
  service.submitGuess({ roomCode: createdRoom.room.roomCode, socketId: 'socket-guest', guess: 'perro' })
  await service.continueRound({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })

  const rematchResponse = service.rematch({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })
  assert.equal(rematchResponse.room.viewState, 'lobby')

  const response = service.closeRoom({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  assert.equal(response.roomCode, createdRoom.room.roomCode)
  assert.equal(service.hasRoom(createdRoom.room.roomCode), false)
})


test('el chat se borra al cerrar la sala y no reaparece si el código se reutiliza', () => {
  const service = new RoomsService()
  forceGeneratedRoomCode(service, 'CHAT42')

  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-host',
  })

  service.sendChatMessage({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
    text: 'Mensaje efímero',
  })

  service.closeRoom({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  const recreatedRoom = service.createRoom({
    nickname: 'Luis',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-new-host',
  })

  assert.equal(recreatedRoom.room.roomCode, 'CHAT42')
  assert.equal(recreatedRoom.room.chatMessages?.length ?? 0, 0)
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

test('el chat de sala guarda remitente, texto y timestamp en el snapshot del room', () => {
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

  const response = service.sendChatMessage({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-guest',
    text: ' Hola equipo ',
  })

  const targets = service.getRoomStateTargets(createdRoom.room.roomCode)

  assert.equal(response.message.roomCode, createdRoom.room.roomCode)
  assert.equal(response.message.senderNickname, 'Luis')
  assert.equal(response.message.text, 'Hola equipo')
  assert.ok(response.message.sentAt)
  assert.equal(targets.every((target) => (target.room.chatMessages?.length ?? 0) === 1), true)
  assert.equal(targets.every((target) => target.room.chatMessages?.[0].senderNickname === 'Luis'), true)
})

test('el chat permanece aislado por sala y rechaza mensajes vacíos', () => {
  const service = new RoomsService()
  const firstRoom = service.createRoom({
    nickname: 'Ana',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-host-1',
  })
  const secondRoom = service.createRoom({
    nickname: 'Marta',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-host-2',
  })

  service.sendChatMessage({
    roomCode: firstRoom.room.roomCode,
    socketId: 'socket-host-1',
    text: 'Mensaje sala 1',
  })

  assert.throws(
    () => service.sendChatMessage({
      roomCode: firstRoom.room.roomCode,
      socketId: 'socket-host-1',
      text: '   ',
    }),
    (error) => error instanceof Error && 'code' in error && error.code === 'INVALID_CHAT_MESSAGE',
  )

  const firstRoomTargets = service.getRoomStateTargets(firstRoom.room.roomCode)
  const secondRoomTargets = service.getRoomStateTargets(secondRoom.room.roomCode)

  assert.equal(firstRoomTargets[0].room.chatMessages?.length, 1)
  assert.equal(firstRoomTargets[0].room.chatMessages?.[0].text, 'Mensaje sala 1')
  assert.equal(secondRoomTargets[0].room.chatMessages?.length ?? 0, 0)
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


test('la limpieza por inactividad también elimina el chat almacenado', () => {
  const service = new RoomsService()
  forceGeneratedRoomCode(service, 'IDLE42')

  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-host',
  })

  service.sendChatMessage({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
    text: 'Mensaje antes del cleanup',
  })

  const closedRooms = service.closeIdleRooms(new Date('2030-01-01T00:10:00.000Z'))
  const recreatedRoom = service.createRoom({
    nickname: 'Luis',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-new-host',
  })

  assert.equal(closedRooms.length, 1)
  assert.equal(closedRooms[0].roomCode, 'IDLE42')
  assert.equal(recreatedRoom.room.roomCode, 'IDLE42')
  assert.equal(recreatedRoom.room.chatMessages?.length ?? 0, 0)
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

test('el host puede iniciar una ronda cooperativa con un solo jugador', async () => {
  const service = createServiceWithWord('bosque')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'coop',
      attemptsPerRound: 4,
      pvpTimerSeconds: null,
    },
    socketId: 'socket-host',
  })

  const response = await service.startMatch({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  assert.equal(response.room.viewState, 'round_active')
  assert.equal(response.room.round.mode, 'coop')
  assert.equal(response.room.round.wordLength, 6)
  assert.equal(response.room.round.attemptsLeft, 4)
  assert.equal(response.room.round.totalAttempts, 4)
  assert.equal(response.room.round.roundsWon, 0)
  assert.equal(response.room.round.roundsLost, 0)
  assert.equal(response.room.round.guessHistory.length, 0)
  assert.equal(response.room.round.status, 'active')
})

test('en cooperativo todos comparten el mismo contador de intentos y el mismo historial', async () => {
  const service = createServiceWithWord('bosque')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'coop',
      attemptsPerRound: 3,
      pvpTimerSeconds: null,
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
    guess: 'frutas',
  })

  const snapshots = service.getRoomStateTargets(createdRoom.room.roomCode).map((target) => target.room)

  assert.equal(snapshots.every((snapshot) => snapshot.viewState === 'round_active'), true)
  assert.equal(snapshots.every((snapshot) => snapshot.round.mode === 'coop'), true)

  for (const snapshot of snapshots) {
    if (snapshot.viewState !== 'round_active' || snapshot.round.mode !== 'coop') {
      throw new Error('Expected an active Co-op round snapshot.')
    }

    assert.equal(snapshot.round.attemptsLeft, 2)
    assert.equal(snapshot.round.roundsWon, 0)
    assert.equal(snapshot.round.roundsLost, 0)
    assert.equal(snapshot.round.guessHistory.length, 1)
    assert.equal(snapshot.round.guessHistory[0].guess, 'frutas')
    assert.equal(snapshot.round.guessHistory[0].submittedByPlayerId, createdRoom.playerId)
  }
})

test('en cooperativo procesa guesses casi simultáneos en orden de recepción del servidor', async () => {
  const service = createServiceWithWord('bosque')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'coop',
      attemptsPerRound: 4,
      pvpTimerSeconds: null,
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
    socketId: 'socket-guest',
    guess: 'frutas',
  })

  service.submitGuess({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
    guess: 'montes',
  })

  const snapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0].room

  if (snapshot.viewState !== 'round_active' || snapshot.round.mode !== 'coop') {
    throw new Error('Expected an active Co-op round snapshot.')
  }

  assert.equal(snapshot.round.attemptsLeft, 2)
  assert.equal(snapshot.round.guessHistory.length, 2)
  assert.equal(snapshot.round.guessHistory[0].guess, 'frutas')
  assert.equal(snapshot.round.guessHistory[0].submittedByPlayerId, snapshot.players.find((player) => player.nickname === 'Luis')?.playerId)
  assert.equal(snapshot.round.guessHistory[1].guess, 'montes')
  assert.equal(snapshot.round.guessHistory[1].submittedByPlayerId, createdRoom.playerId)
})

test('en cooperativo rechaza guesses duplicados del room sin gastar intentos compartidos', async () => {
  const service = createServiceWithWord('bosque')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'coop',
      attemptsPerRound: 3,
      pvpTimerSeconds: null,
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
    guess: 'frutas',
  })

  assert.throws(
    () => service.submitGuess({
      roomCode: createdRoom.room.roomCode,
      socketId: 'socket-guest',
      guess: 'frutas',
    }),
    GuessAlreadySubmittedError,
  )

  const snapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0].room

  if (snapshot.viewState !== 'round_active' || snapshot.round.mode !== 'coop') {
    throw new Error('Expected an active Co-op round snapshot.')
  }

  assert.equal(snapshot.round.attemptsLeft, 2)
  assert.equal(snapshot.round.guessHistory.length, 1)
})

test('en cooperativo una palabra correcta marca la ronda como ganada y actualiza roundsWon sin generar score', async () => {
  const service = createServiceWithWord('bosque')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'coop',
      attemptsPerRound: 3,
      pvpTimerSeconds: null,
    },
    socketId: 'socket-host',
  })

  await service.startMatch({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  service.submitGuess({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
    guess: 'bosque',
  })

  const snapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0].room

  if (snapshot.viewState !== 'round_summary' || snapshot.summary.mode !== 'coop') {
    throw new Error('Expected a Co-op round summary snapshot.')
  }

  assert.equal(snapshot.summary.outcome, 'won')
  assert.equal(snapshot.summary.attemptsLeft, 3)
  assert.equal(snapshot.summary.roundsWon, 1)
  assert.equal(snapshot.summary.roundsLost, 0)
  assert.equal('scoreboard' in snapshot.summary, false)

  assert.throws(
    () => service.submitGuess({
      roomCode: createdRoom.room.roomCode,
      socketId: 'socket-host',
      guess: 'frutas',
    }),
    (error) => error instanceof Error && 'code' in error && error.code === 'ROUND_NOT_ACTIVE',
  )
})

test('en cooperativo agotar los intentos marca derrota y actualiza roundsLost', async () => {
  const service = createServiceWithWord('bosque')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'coop',
      attemptsPerRound: 1,
      pvpTimerSeconds: null,
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
    socketId: 'socket-guest',
    guess: 'frutas',
  })

  const snapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0].room

  if (snapshot.viewState !== 'round_summary' || snapshot.summary.mode !== 'coop') {
    throw new Error('Expected a Co-op round summary snapshot.')
  }

  assert.equal(snapshot.summary.outcome, 'lost')
  assert.equal(snapshot.summary.attemptsLeft, 0)
  assert.equal(snapshot.summary.roundsWon, 0)
  assert.equal(snapshot.summary.roundsLost, 1)
  assert.equal('scoreboard' in snapshot.summary, false)
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

test('actualiza el scoreboard PVP con puntos base, bonos por posición y placements estables', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      attemptsPerRound: 4,
      pvpTimerSeconds: null,
    },
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

  service.joinRoom({
    roomCode: createdRoom.room.roomCode,
    nickname: 'Pablo',
    socketId: 'socket-guest-3',
  })

  await service.startMatch({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  service.submitGuess({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
    guess: 'queso',
  })

  service.submitGuess({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-guest-1',
    guess: 'queso',
  })

  service.submitGuess({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-guest-2',
    guess: 'queso',
  })

  service.submitGuess({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-guest-3',
    guess: 'queso',
  })

  const snapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0].room

  if (snapshot.viewState !== 'round_summary' || snapshot.summary.mode !== 'pvp') {
    throw new Error('Expected a PVP round summary snapshot.')
  }

  const scoresByNickname = new Map(snapshot.summary.scoreboard.map((entry) => [entry.nickname, entry]))

  assert.equal(scoresByNickname.get('Ana')?.totalPoints, PVP_BASE_POINTS + PVP_PLACEMENT_BONUSES[1])
  assert.equal(scoresByNickname.get('Luis')?.totalPoints, PVP_BASE_POINTS + PVP_PLACEMENT_BONUSES[2])
  assert.equal(scoresByNickname.get('Marta')?.totalPoints, PVP_BASE_POINTS + PVP_PLACEMENT_BONUSES[3])
  assert.equal(scoresByNickname.get('Pablo')?.totalPoints, PVP_BASE_POINTS)

  assert.equal(scoresByNickname.get('Ana')?.currentPlacement, 1)
  assert.equal(scoresByNickname.get('Luis')?.currentPlacement, 2)
  assert.equal(scoresByNickname.get('Marta')?.currentPlacement, 3)
  assert.equal(scoresByNickname.get('Pablo')?.currentPlacement, 4)

  assert.ok((PVP_BASE_POINTS + PVP_PLACEMENT_BONUSES[1]) > (PVP_BASE_POINTS + PVP_PLACEMENT_BONUSES[2]))
  assert.ok((PVP_BASE_POINTS + PVP_PLACEMENT_BONUSES[2]) > (PVP_BASE_POINTS + PVP_PLACEMENT_BONUSES[3]))
})

test('mantiene el finish order PVP una vez asignado aunque otros jugadores resuelvan después', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      attemptsPerRound: 4,
      pvpTimerSeconds: null,
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
    guess: 'queso',
  })

  let snapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0].room

  if (snapshot.viewState !== 'round_active' || snapshot.round.mode !== 'pvp') {
    throw new Error('Expected an active PVP round snapshot.')
  }

  assert.equal(snapshot.round.players.find((player) => player.nickname === 'Ana')?.finishPlacement, 1)

  service.submitGuess({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-guest',
    guess: 'queso',
  })

  snapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0].room

  if (snapshot.viewState !== 'round_summary' || snapshot.summary.mode !== 'pvp') {
    throw new Error('Expected a PVP round summary snapshot.')
  }

  assert.equal(snapshot.summary.placements.find((player) => player.nickname === 'Ana')?.placement, 1)
  assert.equal(snapshot.summary.placements.find((player) => player.nickname === 'Luis')?.placement, 2)
})

test('la ronda PVP pasa a summary al terminar y revela la palabra secreta', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      attemptsPerRound: 1,
      pvpTimerSeconds: null,
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
    guess: 'queso',
  })

  service.submitGuess({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-guest',
    guess: 'perro',
  })

  const snapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0].room

  if (snapshot.viewState !== 'round_summary' || snapshot.summary.mode !== 'pvp') {
    throw new Error('Expected a PVP round summary snapshot.')
  }

  assert.equal(snapshot.summary.secretWord, 'queso')
  assert.equal(snapshot.summary.placements.find((player) => player.nickname === 'Ana')?.roundPoints, PVP_BASE_POINTS + PVP_PLACEMENT_BONUSES[1])
  assert.equal(snapshot.summary.placements.find((player) => player.nickname === 'Luis')?.roundPoints, 0)
  assert.ok(snapshot.summaryAutoAdvanceAt)
})

test('el host puede continuar desde el summary y la siguiente ronda reinicia solo el estado de round', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      totalRounds: 2,
      attemptsPerRound: 1,
      pvpTimerSeconds: null,
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

  service.submitGuess({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host', guess: 'queso' })
  service.submitGuess({ roomCode: createdRoom.room.roomCode, socketId: 'socket-guest', guess: 'perro' })

  const response = await service.continueRound({
    roomCode: createdRoom.room.roomCode,
    socketId: 'socket-host',
  })

  assert.equal(response.room.viewState, 'round_active')
  assert.equal(response.room.currentRoundNumber, 2)
  assert.equal(response.room.round.mode, 'pvp')
  assert.equal(response.room.round.scoreboard.find((entry) => entry.nickname === 'Ana')?.totalPoints, PVP_BASE_POINTS + PVP_PLACEMENT_BONUSES[1])
  assert.equal(response.room.round.players.every((player) => player.guessHistory.length === 0), true)
  assert.equal(response.room.round.players.every((player) => player.attemptsLeft === 1), true)
})

test('el autoavance del summary inicia la siguiente ronda cuando no era la última', async () => {
  const service = createServiceWithWord('bosque')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'coop',
      totalRounds: 2,
      attemptsPerRound: 2,
      roundSummaryAutoAdvanceSeconds: 1,
      pvpTimerSeconds: null,
    },
    socketId: 'socket-host',
  })

  await service.startMatch({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })
  service.submitGuess({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host', guess: 'bosque' })

  const updatedRoomCodes = await service.advanceExpiredRoundSummaries(new Date('2100-01-01T00:00:00.000Z'))
  const snapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0].room

  assert.deepEqual(updatedRoomCodes, [createdRoom.room.roomCode])
  assert.equal(snapshot.viewState, 'round_active')
  assert.equal(snapshot.currentRoundNumber, 2)

  if (snapshot.viewState !== 'round_active' || snapshot.round.mode !== 'coop') {
    throw new Error('Expected an active Co-op round snapshot.')
  }

  assert.equal(snapshot.round.roundsWon, 1)
  assert.equal(snapshot.round.roundsLost, 0)
  assert.equal(snapshot.round.guessHistory.length, 0)
  assert.equal(snapshot.round.attemptsLeft, 2)
})

test('al continuar la última ronda la sala pasa a resultados finales', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      totalRounds: 1,
      attemptsPerRound: 1,
      pvpTimerSeconds: null,
    },
    socketId: 'socket-host',
  })

  service.joinRoom({ roomCode: createdRoom.room.roomCode, nickname: 'Luis', socketId: 'socket-guest' })
  await service.startMatch({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })
  service.submitGuess({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host', guess: 'queso' })
  service.submitGuess({ roomCode: createdRoom.room.roomCode, socketId: 'socket-guest', guess: 'perro' })

  const response = await service.continueRound({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })

  assert.equal(response.room.viewState, 'final_results')
  assert.equal(response.room.status, 'match_finished')
  assert.equal(response.room.finalResults.mode, 'pvp')
  assert.equal(response.room.finalResults.standings[0].nickname, 'Ana')
  assert.equal(response.room.finalResults.standings[0].totalPoints, PVP_BASE_POINTS + PVP_PLACEMENT_BONUSES[1])
})

test('al continuar la última ronda cooperativa la sala pasa a resultados finales del equipo', async () => {
  const service = createServiceWithWord('bosque')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'coop',
      totalRounds: 1,
      attemptsPerRound: 2,
      pvpTimerSeconds: null,
    },
    socketId: 'socket-host',
  })

  await service.startMatch({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })
  service.submitGuess({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host', guess: 'bosque' })

  const response = await service.continueRound({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })

  assert.equal(response.room.viewState, 'final_results')
  assert.equal(response.room.status, 'match_finished')
  assert.equal(response.room.finalResults.mode, 'coop')
  assert.equal(response.room.finalResults.roundsWon, 1)
  assert.equal(response.room.finalResults.roundsLost, 0)
  assert.equal(response.room.finalResults.totalRounds, 1)
})


test('el autoavance del último summary también lleva a resultados finales dentro de la sala', async () => {
  const service = createServiceWithWord('bosque')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'coop',
      totalRounds: 1,
      attemptsPerRound: 2,
      roundSummaryAutoAdvanceSeconds: 1,
      pvpTimerSeconds: null,
    },
    socketId: 'socket-host',
  })

  await service.startMatch({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })
  service.submitGuess({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host', guess: 'bosque' })

  const updatedRoomCodes = await service.advanceExpiredRoundSummaries(new Date('2100-01-01T00:00:00.000Z'))
  const snapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0].room

  assert.deepEqual(updatedRoomCodes, [createdRoom.room.roomCode])
  assert.equal(snapshot.viewState, 'final_results')
  assert.equal(snapshot.status, 'match_finished')

  if (snapshot.viewState !== 'final_results' || snapshot.finalResults.mode !== 'coop') {
    throw new Error('Expected a final Co-op results snapshot.')
  }

  assert.equal(snapshot.finalResults.roundsWon, 1)
  assert.equal(snapshot.finalResults.roundsLost, 0)
})

test('la revancha devuelve la sala al lobby y reinicia el estado acumulado sin perder jugadores', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      totalRounds: 1,
      attemptsPerRound: 1,
      pvpTimerSeconds: null,
    },
    socketId: 'socket-host',
  })

  service.joinRoom({ roomCode: createdRoom.room.roomCode, nickname: 'Luis', socketId: 'socket-guest' })
  await service.startMatch({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })
  service.submitGuess({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host', guess: 'queso' })
  service.submitGuess({ roomCode: createdRoom.room.roomCode, socketId: 'socket-guest', guess: 'perro' })
  await service.continueRound({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })

  const rematchResponse = service.rematch({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })

  assert.equal(rematchResponse.room.viewState, 'lobby')
  assert.equal(rematchResponse.room.currentRoundNumber, 0)
  assert.equal(rematchResponse.room.players.length, 2)
  assert.equal(rematchResponse.room.canCurrentPlayerStartMatch, true)

  const restartedMatch = await service.startMatch({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })

  assert.equal(restartedMatch.room.viewState, 'round_active')
  assert.equal(restartedMatch.room.round.mode, 'pvp')
  assert.equal(restartedMatch.room.round.scoreboard.every((entry) => entry.totalPoints === 0), true)
  assert.equal(restartedMatch.room.round.players.every((player) => player.guessHistory.length === 0), true)
})

test('solo el host puede pedir revancha y el cooperativo reinicia roundsWon/roundsLost', async () => {
  const service = createServiceWithWord('bosque')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'coop',
      totalRounds: 1,
      attemptsPerRound: 2,
      pvpTimerSeconds: null,
    },
    socketId: 'socket-host',
  })

  service.joinRoom({ roomCode: createdRoom.room.roomCode, nickname: 'Luis', socketId: 'socket-guest' })
  await service.startMatch({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })
  service.submitGuess({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host', guess: 'bosque' })
  await service.continueRound({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })

  assert.throws(
    () => service.rematch({ roomCode: createdRoom.room.roomCode, socketId: 'socket-guest' }),
    NotHostError,
  )

  service.rematch({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })
  const restartedMatch = await service.startMatch({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' })

  assert.equal(restartedMatch.room.round.mode, 'coop')

  if (restartedMatch.room.round.mode !== 'coop') {
    throw new Error('Expected an active Co-op round snapshot.')
  }

  assert.equal(restartedMatch.room.round.roundsWon, 0)
  assert.equal(restartedMatch.room.round.roundsLost, 0)
  assert.equal(restartedMatch.room.round.guessHistory.length, 0)
})

test('la expiración del temporizador cierra la ronda PVP y rechaza guesses tardíos', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      attemptsPerRound: 3,
      pvpTimerSeconds: 1,
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

  const updatedRooms = service.expireElapsedPvpRounds(new Date('2100-01-01T00:00:00.000Z'))

  assert.deepEqual(updatedRooms, [createdRoom.room.roomCode])

  const snapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0].room

  if (snapshot.viewState !== 'round_summary' || snapshot.summary.mode !== 'pvp') {
    throw new Error('Expected a PVP round summary snapshot.')
  }

  assert.equal(snapshot.summary.secretWord, 'queso')
  assert.equal(snapshot.summary.timer.enabled, true)
  assert.equal(snapshot.summary.timer.remainingSeconds, 0)
  assert.equal(snapshot.summary.placements.every((player) => player.placement === null), true)

  assert.throws(
    () => service.submitGuess({
      roomCode: createdRoom.room.roomCode,
      socketId: 'socket-host',
      guess: 'queso',
    }),
    (error) => error instanceof Error && 'code' in error && error.code === 'ROUND_NOT_ACTIVE',
  )
})

test('la lógica de expiración se omite cuando la ronda PVP no tiene temporizador', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
      attemptsPerRound: 3,
      pvpTimerSeconds: null,
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

  const updatedRooms = service.expireElapsedPvpRounds(new Date('2100-01-01T00:00:00.000Z'))
  const snapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0].room

  assert.deepEqual(updatedRooms, [])
  assert.equal(snapshot.viewState, 'round_active')
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

test('cerrar la pestaña marca al jugador como reconectando y mantiene su lugar durante la gracia', () => {
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
  assert.equal(targets.length, 2)
  assert.equal(targets.every((target) => target.room.players.length === 2), true)
  assert.equal(targets.every((target) => target.room.players.find((player) => player.nickname === 'Luis')?.connectionState === 'reconnecting'), true)
})

test('puede reanudar la sesión dentro del período de gracia y conservar el playerId', () => {
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

  service.disconnectSocket('socket-guest')

  const resumedSession = service.resumeSession({
    roomCode: createdRoom.room.roomCode,
    playerId: joinedRoom.playerId,
    resumeToken: joinedRoom.resumeToken,
    socketId: 'socket-guest-new',
  })

  assert.equal(resumedSession.room.currentPlayerId, joinedRoom.playerId)
  assert.equal(resumedSession.room.players.find((player) => player.playerId === joinedRoom.playerId)?.connectionState, 'connected')

  const targets = service.getRoomStateTargets(createdRoom.room.roomCode)
  assert.equal(targets.some((target) => target.socketId === 'socket-guest-new'), true)
})

test('si el host está desconectado no cuenta para iniciar PVP hasta reconectarse', async () => {
  const service = createServiceWithWord('queso')
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      mode: 'pvp',
    },
    socketId: 'socket-host',
  })

  service.joinRoom({
    roomCode: createdRoom.room.roomCode,
    nickname: 'Luis',
    socketId: 'socket-guest',
  })

  service.disconnectSocket('socket-guest')

  const snapshot = service.getRoomStateTargets(createdRoom.room.roomCode)[0].room

  assert.equal(snapshot.viewState, 'lobby')
  assert.equal(snapshot.canCurrentPlayerStartMatch, false)

  await assert.rejects(
    () => service.startMatch({ roomCode: createdRoom.room.roomCode, socketId: 'socket-host' }),
    StartNotAllowedError,
  )
})

test('si la gracia expira, el jugador se elimina y el host se transfiere si hacía falta', () => {
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

  service.disconnectSocket('socket-host')
  const expirationResult = service.expireReconnectGracePeriods(new Date('2100-01-01T00:00:00.000Z'))
  const targets = service.getRoomStateTargets(createdRoom.room.roomCode)

  assert.deepEqual(expirationResult.closedRooms, [])
  assert.deepEqual(expirationResult.updatedRoomCodes, [createdRoom.room.roomCode])
  assert.equal(targets.length, 1)
  assert.equal(targets[0].room.hostPlayerId, targets[0].room.players[0].playerId)
  assert.equal(targets[0].room.players[0].nickname, 'Luis')
  assert.equal(targets[0].room.players[0].isHost, true)
})

test('si la gracia expira para la última sesión, la sala se elimina', () => {
  const service = new RoomsService()
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-host',
  })

  service.disconnectSocket('socket-host')
  const expirationResult = service.expireReconnectGracePeriods(new Date('2100-01-01T00:00:00.000Z'))

  assert.deepEqual(expirationResult.updatedRoomCodes, [])
  assert.equal(expirationResult.closedRooms.length, 1)
  assert.equal(expirationResult.closedRooms[0].roomCode, createdRoom.room.roomCode)
  assert.equal(service.hasRoom(createdRoom.room.roomCode), false)
})

test('si la sesión ya expiró no se puede reanudar', () => {
  const service = new RoomsService()
  const createdRoom = service.createRoom({
    nickname: 'Ana',
    settings: DEFAULT_ROOM_SETTINGS,
    socketId: 'socket-host',
  })

  service.disconnectSocket('socket-host')
  service.expireReconnectGracePeriods(new Date('2100-01-01T00:00:00.000Z'))

  assert.throws(
    () => service.resumeSession({
      roomCode: createdRoom.room.roomCode,
      playerId: createdRoom.playerId,
      resumeToken: createdRoom.resumeToken,
      socketId: 'socket-host-new',
    }),
    ReconnectExpiredError,
  )
})
