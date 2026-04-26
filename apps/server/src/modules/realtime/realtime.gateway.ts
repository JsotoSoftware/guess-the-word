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
import { Server, Socket } from 'socket.io'
import { AppConfigService } from '../../config/app-config.service'

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

  constructor(private readonly config: AppConfigService) {}

  handleConnection(client: Socket): void {
    this.logger.log(`Socket connected: ${client.id} (clientUrl: ${this.config.clientUrl})`)
    client.emit('server:ready', {
      socketId: client.id,
      connectedAt: new Date().toISOString(),
    })
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Socket disconnected: ${client.id}`)
  }

  @SubscribeMessage('client:ping')
  handlePing(
    @MessageBody() payload: PingPayload,
    @ConnectedSocket() client: Socket,
  ): PongPayload {
    this.logger.debug(`Received client:ping from ${client.id}`)

    return {
      message: 'pong',
      serverTime: new Date().toISOString(),
      receivedTimestamp: payload.timestamp ?? null,
    }
  }
}
