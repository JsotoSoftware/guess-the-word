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
  type ChatMessageEvent,
  type CloseRoomRequest,
  type CloseRoomResponse,
  type ContinueRoundRequest,
  type ContinueRoundResponse,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type JoinRoomRequest,
  type JoinRoomResponse,
  type LeaveRoomRequest,
  type LeaveRoomResponse,
  type RematchRequest,
  type RematchResponse,
  type ResumeSessionRequest,
  type ResumeSessionResponse,
  type RoomClosedEvent,
  type RoomSnapshot,
  type RoomStateEvent,
  type SendChatMessageRequest,
  type SendChatMessageResponse,
  type StartMatchRequest,
  type StartMatchResponse,
  type SubmitGuessRequest,
  type SubmitGuessResponse,
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
  resumeSession: (payload: ResumeSessionRequest) => Promise<ResumeSessionResponse>
  updateRoomSettings: (payload: UpdateRoomSettingsRequest) => Promise<UpdateRoomSettingsResponse>
  continueRound: (payload: ContinueRoundRequest) => Promise<ContinueRoundResponse>
  rematch: (payload: RematchRequest) => Promise<RematchResponse>
  startMatch: (payload: StartMatchRequest) => Promise<StartMatchResponse>
  submitGuess: (payload: SubmitGuessRequest) => Promise<SubmitGuessResponse>
  sendChatMessage: (payload: SendChatMessageRequest) => Promise<SendChatMessageResponse>
  leaveRoom: (payload: LeaveRoomRequest) => Promise<LeaveRoomResponse>
  closeRoom: (payload: CloseRoomRequest) => Promise<CloseRoomResponse>
  clearClosedRoomCode: () => void
}

const RoomSessionContext = createContext<RoomSessionContextValue | undefined>(undefined)
const ROOM_SESSION_STORAGE_KEY = 'guess-the-word.room-session'

interface StoredRoomSession {
  roomCode: string
  playerId: string
  resumeToken: string
}

class SocketAckError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'SocketAckError'
  }
}

function readStoredRoomSession(): StoredRoomSession | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(ROOM_SESSION_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue) as Partial<StoredRoomSession>

    if (
      typeof parsedValue.roomCode !== 'string'
      || typeof parsedValue.playerId !== 'string'
      || typeof parsedValue.resumeToken !== 'string'
    ) {
      return null
    }

    return parsedValue as StoredRoomSession
  } catch {
    return null
  }
}

function writeStoredRoomSession(session: StoredRoomSession): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(ROOM_SESSION_STORAGE_KEY, JSON.stringify(session))
}

function clearStoredRoomSession(): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(ROOM_SESSION_STORAGE_KEY)
}

function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la operación.'
}

export function RoomSessionProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null)
  const autoResumeInFlightRef = useRef(false)
  const autoResumeRetryTimeoutRef = useRef<number | null>(null)
  const [connected, setConnected] = useState(false)
  const [room, setRoom] = useState<RoomSnapshot | null>(null)
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(() => readStoredRoomSession()?.playerId ?? null)
  const [resumeToken, setResumeToken] = useState<string | null>(() => readStoredRoomSession()?.resumeToken ?? null)
  const [closedRoomCode, setClosedRoomCode] = useState<string | null>(null)

  useEffect(() => {
    const socket = io(env.socketUrl, {
      transports: ['polling', 'websocket'],
      withCredentials: true,
    })

    socketRef.current = socket

    const clearPendingAutoResumeRetry = () => {
      if (autoResumeRetryTimeoutRef.current !== null) {
        window.clearTimeout(autoResumeRetryTimeoutRef.current)
        autoResumeRetryTimeoutRef.current = null
      }
    }

    const scheduleAutoResumeRetry = () => {
      if (autoResumeRetryTimeoutRef.current !== null) {
        return
      }

      autoResumeRetryTimeoutRef.current = window.setTimeout(() => {
        autoResumeRetryTimeoutRef.current = null
        attemptStoredSessionResume()
      }, 3000)
    }

    const attemptStoredSessionResume = () => {
      const storedSession = readStoredRoomSession()

      if (!storedSession || autoResumeInFlightRef.current || !socket.connected) {
        return
      }

      clearPendingAutoResumeRetry()
      autoResumeInFlightRef.current = true

      socket.timeout(10000).emit(
        SOCKET_EVENTS.sessionResume,
        storedSession,
        (timeoutError: Error | null, response?: Ack<ResumeSessionResponse>) => {
          autoResumeInFlightRef.current = false

          if (timeoutError || !response) {
            scheduleAutoResumeRetry()
            return
          }

          if (!response.ok) {
            if (response.error.code === 'RECONNECT_EXPIRED') {
              clearPendingAutoResumeRetry()
              clearStoredRoomSession()
              setRoom(null)
              setCurrentPlayerId(null)
              setResumeToken(null)
              return
            }

            scheduleAutoResumeRetry()
            return
          }

          clearPendingAutoResumeRetry()
          setRoom(response.data.room)
          setCurrentPlayerId(storedSession.playerId)
          setResumeToken(storedSession.resumeToken)
          setClosedRoomCode(null)
        },
      )
    }

    const handleConnect = () => {
      setConnected(true)
      attemptStoredSessionResume()
    }
    const handleDisconnect = () => {
      setConnected(false)
      clearPendingAutoResumeRetry()
    }

    const handleVisibilityOrOnline = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }

      if (!readStoredRoomSession()) {
        return
      }

      if (!socket.connected) {
        socket.connect()
        return
      }

      attemptStoredSessionResume()
    }
    const handleRoomState = (event: RoomStateEvent) => {
      setRoom(event.room)
      setCurrentPlayerId(event.room.currentPlayerId)
      setClosedRoomCode(null)
    }
    const handleRoomClosed = (event: RoomClosedEvent) => {
      clearStoredRoomSession()
      setRoom(null)
      setCurrentPlayerId(null)
      setResumeToken(null)
      setClosedRoomCode(event.roomCode)
    }
    const handleChatMessage = (event: ChatMessageEvent) => {
      setRoom((currentRoom) => {
        if (!currentRoom || currentRoom.roomCode !== event.message.roomCode) {
          return currentRoom
        }

        const currentMessages = currentRoom.chatMessages ?? []

        if (currentMessages.some((message) => message.messageId === event.message.messageId)) {
          return currentRoom
        }

        return {
          ...currentRoom,
          chatMessages: [...currentMessages, event.message],
        }
      })
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on(SOCKET_EVENTS.roomState, handleRoomState)
    socket.on(SOCKET_EVENTS.roomClosed, handleRoomClosed)
    socket.on(SOCKET_EVENTS.chatMessage, handleChatMessage)
    window.addEventListener('online', handleVisibilityOrOnline)
    document.addEventListener('visibilitychange', handleVisibilityOrOnline)

    if (socket.connected) {
      handleConnect()
    } else {
      setConnected(false)
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off(SOCKET_EVENTS.roomState, handleRoomState)
      socket.off(SOCKET_EVENTS.roomClosed, handleRoomClosed)
      socket.off(SOCKET_EVENTS.chatMessage, handleChatMessage)
      window.removeEventListener('online', handleVisibilityOrOnline)
      document.removeEventListener('visibilitychange', handleVisibilityOrOnline)
      clearPendingAutoResumeRetry()
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

      socket.timeout(10000).emit(eventName, payload, (timeoutError: Error | null, response?: Ack<TResponse>) => {
        if (timeoutError) {
          reject(new Error('La solicitud tardó demasiado y no recibió respuesta.'))
          return
        }

        if (!response) {
          reject(new Error('El servidor respondió sin datos.'))
          return
        }

        if (!response.ok) {
          reject(new SocketAckError(response.error.message, response.error.code))
          return
        }

        resolve(response.data)
      })
    })
  }, [])

  const createRoom = useCallback(async (payload: CreateRoomRequest) => {
    try {
      const response = await emitWithAck<CreateRoomResponse, CreateRoomRequest>(SOCKET_EVENTS.roomCreate, payload)
      writeStoredRoomSession({
        roomCode: response.room.roomCode,
        playerId: response.playerId,
        resumeToken: response.resumeToken,
      })
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
      writeStoredRoomSession({
        roomCode: response.room.roomCode,
        playerId: response.playerId,
        resumeToken: response.resumeToken,
      })
      setRoom(response.room)
      setCurrentPlayerId(response.playerId)
      setResumeToken(response.resumeToken)
      setClosedRoomCode(null)
      return response
    } catch (error) {
      throw new Error(extractErrorMessage(error))
    }
  }, [emitWithAck])

  const resumeSession = useCallback(async (payload: ResumeSessionRequest) => {
    try {
      const response = await emitWithAck<ResumeSessionResponse, ResumeSessionRequest>(SOCKET_EVENTS.sessionResume, payload)
      writeStoredRoomSession({
        roomCode: payload.roomCode,
        playerId: payload.playerId,
        resumeToken: payload.resumeToken,
      })
      setRoom(response.room)
      setCurrentPlayerId(payload.playerId)
      setResumeToken(payload.resumeToken)
      setClosedRoomCode(null)
      return response
    } catch (error) {
      if (error instanceof SocketAckError && error.code === 'RECONNECT_EXPIRED') {
        clearStoredRoomSession()
        setRoom(null)
        setCurrentPlayerId(null)
        setResumeToken(null)
      }

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

  const startMatch = useCallback(async (payload: StartMatchRequest) => {
    try {
      const response = await emitWithAck<StartMatchResponse, StartMatchRequest>(SOCKET_EVENTS.roomStartMatch, payload)
      setRoom(response.room)
      return response
    } catch (error) {
      throw new Error(extractErrorMessage(error))
    }
  }, [emitWithAck])

  const continueRound = useCallback(async (payload: ContinueRoundRequest) => {
    try {
      const response = await emitWithAck<ContinueRoundResponse, ContinueRoundRequest>(SOCKET_EVENTS.roundContinue, payload)
      setRoom(response.room)
      return response
    } catch (error) {
      throw new Error(extractErrorMessage(error))
    }
  }, [emitWithAck])

  const rematch = useCallback(async (payload: RematchRequest) => {
    try {
      const response = await emitWithAck<RematchResponse, RematchRequest>(SOCKET_EVENTS.roomRematch, payload)
      setRoom(response.room)
      return response
    } catch (error) {
      throw new Error(extractErrorMessage(error))
    }
  }, [emitWithAck])

  const submitGuess = useCallback(async (payload: SubmitGuessRequest) => {
    try {
      const response = await emitWithAck<SubmitGuessResponse, SubmitGuessRequest>(SOCKET_EVENTS.gameSubmitGuess, payload)
      return response
    } catch (error) {
      throw new Error(extractErrorMessage(error))
    }
  }, [emitWithAck])

  const sendChatMessage = useCallback(async (payload: SendChatMessageRequest) => {
    try {
      const response = await emitWithAck<SendChatMessageResponse, SendChatMessageRequest>(SOCKET_EVENTS.chatSend, payload)
      return response
    } catch (error) {
      throw new Error(extractErrorMessage(error))
    }
  }, [emitWithAck])

  const leaveRoom = useCallback(async (payload: LeaveRoomRequest) => {
    try {
      const response = await emitWithAck<LeaveRoomResponse, LeaveRoomRequest>(SOCKET_EVENTS.roomLeave, payload)
      clearStoredRoomSession()
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
      clearStoredRoomSession()
      setRoom(null)
      setCurrentPlayerId(null)
      setResumeToken(null)
      setClosedRoomCode(response.roomCode)
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
    resumeSession,
    updateRoomSettings,
    startMatch,
    continueRound,
    rematch,
    submitGuess,
    sendChatMessage,
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
    resumeSession,
    updateRoomSettings,
    startMatch,
    continueRound,
    rematch,
    submitGuess,
    sendChatMessage,
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
