import { Module } from '@nestjs/common'
import { RoomsModule } from '../rooms/rooms.module'
import { RealtimeGateway } from './realtime.gateway'

@Module({
  imports: [RoomsModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
