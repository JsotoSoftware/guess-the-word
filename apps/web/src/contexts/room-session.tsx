import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  SOCKET_EVENTS,
  type Ack,
  type CloseRoomRequest,
  type CloseRoomResponse,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type JoinRoomRequest,
  type JoinRoomResponse,
  type LeaveRoomRequest,
  type LeaveRoomResponse,
  type RoomClosedEvent,
  type RoomSnapshot,
  type RoomStateEvent,
  type UpdateRoomSettingsRequest,
  type UpdateRoomSettingsResponse,
} from '@guess-the-word/shared'
import { io, type Socket } from 'socket.io-client'
import { env } from '../lib/env'

interface RoomSessionContextValue {
  connected: boolean
  room: RoomSnapshot | null
  currentPlayerId: string | null
  resumeToken: string | null
  closedRoomCode: string | null
  createRoom: (payload: CreateRoomRequest) => Promise<CreateRoomResponse>
  joinRoom: (payload: JoinRoomRequest) => Promise<JoinRoomResponse>
  updateRoomSettings: (payload: UpdateRoomSettingsRequest) => Promise<UpdateRoomSettingsResponse>
  leaveRoom: (payload: LeaveRoomRequest) => Promise<LeaveRoomResponse>
  closeRoom: (payload: CloseRoomRequest) => Promise<CloseRoomResponse>
  clearClosedRoomCode: () => void
}

const RoomSessionContext = createContext<RoomSessionContextValue | undefined>(undefined)

function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la operación.'
}

export function RoomSessionProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [room, setRoom] = useState<RoomSnapshot | null>(null)
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null)
  const [resumeToken, setResumeToken] = useState<string | null>(null)
  const [closedRoomCode, setClosedRoomCode] = useState<string | null>(null)

  useEffect(() => {
    const socket = io(env.socketUrl, {
      transports: ['websocket'],
      withCredentials: true,
    })

    socketRef.current = socket

    const handleConnect = () => setConnected(true)
    const handleDisconnect = () => setConnected(false)
    const handleRoomState = (event: RoomStateEvent) => {
      setRoom(event.room)
      setCurrentPlayerId(event.room.currentPlayerId)
      setClosedRoomCode(null)
    }
    const handleRoomClosed = (event: RoomClosedEvent) => {
      setRoom(null)
      setCurrentPlayerId(null)
      setResumeToken(null)
      setClosedRoomCode(event.roomCode)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on(SOCKET_EVENTS.roomState, handleRoomState)
    socket.on(SOCKET_EVENTS.roomClosed, handleRoomClosed)

    setConnected(socket.connected)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off(SOCKET_EVENTS.roomState, handleRoomState)
      socket.off(SOCKET_EVENTS.roomClosed, handleRoomClosed)
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const emitWithAck = useCallback(function emitWithAck<TResponse, TRequest extends object>(eventName: string, payload: TRequest) {
    return new Promise<TResponse>((resolve, reject) => {
      const socket = socketRef.current

      if (!socket) {
        reject(new Error('La conexión con el servidor aún no está lista.'))
        return
      }

      socket.timeout(5000).emit(eventName, payload, (timeoutError: Error | null, response?: Ack<TResponse>) => {
        if (timeoutError) {
          reject(new Error('La solicitud tardó demasiado y no recibió respuesta.'))
          return
        }

        if (!response) {
          reject(new Error('El servidor respondió sin datos.'))
          return
        }

        if (!response.ok) {
          reject(new Error(response.error.message))
          return
        }

        resolve(response.data)
      })
    })
  }, [])

  const createRoom = useCallback(async (payload: CreateRoomRequest) => {
    try {
      const response = await emitWithAck<CreateRoomResponse, CreateRoomRequest>(SOCKET_EVENTS.roomCreate, payload)
      setRoom(response.room)
      setCurrentPlayerId(response.playerId)
      setResumeToken(response.resumeToken)
      setClosedRoomCode(null)
      return response
    } catch (error) {
      throw new Error(extractErrorMessage(error))
    }
  }, [emitWithAck])

  const joinRoom = useCallback(async (payload: JoinRoomRequest) => {
    try {
      const response = await emitWithAck<JoinRoomResponse, JoinRoomRequest>(SOCKET_EVENTS.roomJoin, payload)
      setRoom(response.room)
      setCurrentPlayerId(response.playerId)
      setResumeToken(response.resumeToken)
      setClosedRoomCode(null)
      return response
    } catch (error) {
      throw new Error(extractErrorMessage(error))
    }
  }, [emitWithAck])

  const updateRoomSettings = useCallback(async (payload: UpdateRoomSettingsRequest) => {
    try {
      const response = await emitWithAck<UpdateRoomSettingsResponse, UpdateRoomSettingsRequest>(SOCKET_EVENTS.roomUpdateSettings, payload)
      setRoom(response.room)
      return response
    } catch (error) {
      throw new Error(extractErrorMessage(error))
    }
  }, [emitWithAck])

  const leaveRoom = useCallback(async (payload: LeaveRoomRequest) => {
    try {
      const response = await emitWithAck<LeaveRoomResponse, LeaveRoomRequest>(SOCKET_EVENTS.roomLeave, payload)
      setRoom(null)
      setCurrentPlayerId(null)
      setResumeToken(null)
      return response
    } catch (error) {
      throw new Error(extractErrorMessage(error))
    }
  }, [emitWithAck])

  const closeRoom = useCallback(async (payload: CloseRoomRequest) => {
    try {
      const response = await emitWithAck<CloseRoomResponse, CloseRoomRequest>(SOCKET_EVENTS.roomClose, payload)
      return response
    } catch (error) {
      throw new Error(extractErrorMessage(error))
    }
  }, [emitWithAck])

  const clearClosedRoomCode = useCallback(() => {
    setClosedRoomCode(null)
  }, [])

  const value = useMemo<RoomSessionContextValue>(() => ({
    connected,
    room,
    currentPlayerId,
    resumeToken,
    closedRoomCode,
    createRoom,
    joinRoom,
    updateRoomSettings,
    leaveRoom,
    closeRoom,
    clearClosedRoomCode,
  }), [
    connected,
    room,
    currentPlayerId,
    resumeToken,
    closedRoomCode,
    createRoom,
    joinRoom,
    updateRoomSettings,
    leaveRoom,
    closeRoom,
    clearClosedRoomCode,
  ])

  return <RoomSessionContext.Provider value={value}>{children}</RoomSessionContext.Provider>
}

export function useRoomSession() {
  const context = useContext(RoomSessionContext)

  if (!context) {
    throw new Error('useRoomSession debe usarse dentro de RoomSessionProvider.')
  }

  return context
}
