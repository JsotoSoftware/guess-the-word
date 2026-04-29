import test from 'node:test'
import assert from 'node:assert/strict'
import { RoomsService, RoomClosedError, RoomNotFoundError } from './rooms.service'
import { DEFAULT_ROOM_SETTINGS } from '@guess-the-word/shared'

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

  service.closeRoom(createdRoom.room.roomCode)

  assert.throws(
    () => service.joinRoom({ roomCode: createdRoom.room.roomCode, nickname: 'Luis', socketId: 'socket-guest' }),
    RoomClosedError,
  )
})
