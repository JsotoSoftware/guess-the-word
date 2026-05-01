import test from 'node:test'
import assert from 'node:assert/strict'
import { SOCKET_EVENTS, type RoomClosedEvent } from '@guess-the-word/shared'
import type { Server } from 'socket.io'
import { RealtimeGateway } from './realtime.gateway'

test('al cerrar una sala el gateway emite room:closed y libera el room de socket.io', () => {
  const emittedEvents: Array<{ roomCode: string; eventName: string; payload: RoomClosedEvent }> = []
  const socketsLeaveCalls: string[] = []

  const gateway = new RealtimeGateway(
    { clientUrl: 'http://localhost:5173' } as never,
    {} as never,
  )

  gateway.server = {
    to(roomCode: string) {
      return {
        emit(eventName: string, payload: RoomClosedEvent) {
          emittedEvents.push({ roomCode, eventName, payload })
        },
      }
    },
    in(roomCode: string) {
      return {
        socketsLeave(targetRoomCode: string) {
          socketsLeaveCalls.push(`${roomCode}:${targetRoomCode}`)
        },
      }
    },
  } as unknown as Server

  const closedEvent: RoomClosedEvent = {
    roomCode: 'CHAT42',
    closedAt: '2026-04-30T00:00:00.000Z',
  }

  ;(gateway as unknown as { emitRoomClosed: (event: RoomClosedEvent) => void }).emitRoomClosed(closedEvent)

  assert.deepEqual(emittedEvents, [
    {
      roomCode: 'CHAT42',
      eventName: SOCKET_EVENTS.roomClosed,
      payload: closedEvent,
    },
  ])
  assert.deepEqual(socketsLeaveCalls, ['CHAT42:CHAT42'])
})
