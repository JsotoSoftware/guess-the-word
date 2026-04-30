import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import {
  SOCKET_EVENTS,
  type Ack,
  type AppError,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type JoinRoomRequest,
  type JoinRoomResponse,
  type LeaveRoomRequest,
  type LeaveRoomResponse,
  type UpdateRoomSettingsRequest,
  type UpdateRoomSettingsResponse,
} from '@guess-the-word/shared'
import { Server, Socket } from 'socket.io'
import { AppConfigService } from '../../config/app-config.service'
import { RoomsService } from '../rooms/rooms.service'

interface PingPayload {
  timestamp?: string
}

interface PongPayload {
  message: 'pong'
  serverTime: string
  receivedTimestamp: string | null
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name)

  @WebSocketServer()
  server!: Server

  constructor(
    private readonly config: AppConfigService,
    private readonly roomsService: RoomsService,
  ) {}

  handleConnection(client: Socket): void {
    this.logger.log(`Socket connected: ${client.id} (clientUrl: ${this.config.clientUrl})`)
    client.emit(SOCKET_EVENTS.serverReady, {
      socketId: client.id,
      connectedAt: new Date().toISOString(),
    })
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Socket disconnected: ${client.id}`)

    const roomResult = this.roomsService.disconnectSocket(client.id)

    if (roomResult?.roomStillExists) {
      this.emitRoomState(roomResult.roomCode)
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.clientPing)
  handlePing(
    @MessageBody() payload: PingPayload,
    @ConnectedSocket() client: Socket,
  ): PongPayload {
    this.logger.debug(`Received ${SOCKET_EVENTS.clientPing} from ${client.id}`)

    return {
      message: 'pong',
      serverTime: new Date().toISOString(),
      receivedTimestamp: payload.timestamp ?? null,
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.roomCreate)
  handleCreateRoom(
    @MessageBody() payload: CreateRoomRequest,
    @ConnectedSocket() client: Socket,
  ): Ack<CreateRoomResponse> {
    try {
      const response = this.roomsService.createRoom({
        nickname: payload.nickname,
        settings: payload.settings,
        socketId: client.id,
      })

      void client.join(response.room.roomCode)
      this.emitRoomState(response.room.roomCode)

      return {
        ok: true,
        data: response,
      }
    } catch (error) {
      this.logger.warn(`room:create failed for ${client.id}: ${this.getErrorMessage(error)}`)
      return this.toAckFailure(error)
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.roomJoin)
  handleJoinRoom(
    @MessageBody() payload: JoinRoomRequest,
    @ConnectedSocket() client: Socket,
  ): Ack<JoinRoomResponse> {
    try {
      const response = this.roomsService.joinRoom({
        roomCode: payload.roomCode,
        nickname: payload.nickname,
        socketId: client.id,
      })

      void client.join(response.room.roomCode)
      this.emitRoomState(response.room.roomCode)

      return {
        ok: true,
        data: response,
      }
    } catch (error) {
      this.logger.warn(`room:join failed for ${client.id}: ${this.getErrorMessage(error)}`)
      return this.toAckFailure(error)
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.roomUpdateSettings)
  handleUpdateRoomSettings(
    @MessageBody() payload: UpdateRoomSettingsRequest,
    @ConnectedSocket() client: Socket,
  ): Ack<UpdateRoomSettingsResponse> {
    try {
      const response = this.roomsService.updateRoomSettings({
        roomCode: payload.roomCode,
        socketId: client.id,
        settings: payload.settings,
      })

      this.emitRoomState(payload.roomCode)

      return {
        ok: true,
        data: response,
      }
    } catch (error) {
      this.logger.warn(`room:update_settings failed for ${client.id}: ${this.getErrorMessage(error)}`)
      return this.toAckFailure(error)
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.roomLeave)
  handleLeaveRoom(
    @MessageBody() payload: LeaveRoomRequest,
    @ConnectedSocket() client: Socket,
  ): Ack<LeaveRoomResponse> {
    try {
      const result = this.roomsService.leaveRoom({
        roomCode: payload.roomCode,
        socketId: client.id,
      })

      void client.leave(payload.roomCode)

      if (result.roomStillExists) {
        this.emitRoomState(payload.roomCode)
      }

      return {
        ok: true,
        data: result.response,
      }
    } catch (error) {
      this.logger.warn(`room:leave failed for ${client.id}: ${this.getErrorMessage(error)}`)
      return this.toAckFailure(error)
    }
  }

  private emitRoomState(roomCode: string): void {
    if (!this.roomsService.hasRoom(roomCode)) {
      return
    }

    const targets = this.roomsService.getRoomStateTargets(roomCode)

    for (const target of targets) {
      this.server.to(target.socketId).emit(SOCKET_EVENTS.roomState, {
        room: target.room,
      })
    }
  }

  private toAckFailure(error: unknown): Ack<never> {
    return {
      ok: false,
      error: this.toAppError(error),
    }
  }

  private toAppError(error: unknown): AppError {
    if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
      const appError = error as { code: string; message: string; details?: Record<string, unknown> }
      return {
        code: appError.code,
        message: appError.message,
        details: appError.details,
      }
    }

    return {
      code: 'INTERNAL_ERROR',
      message: 'Ocurrió un error inesperado al procesar la solicitud.',
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error'
  }
}
