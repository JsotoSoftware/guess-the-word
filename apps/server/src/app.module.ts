import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppConfigModule } from './config/app-config.module'
import { DatabaseModule } from './db/database.module'
import { HealthModule } from './modules/health/health.module'
import { RealtimeModule } from './modules/realtime/realtime.module'
import { RoomsModule } from './modules/rooms/rooms.module'
import { WordsModule } from './modules/words/words.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      envFilePath: ['apps/server/.env', '.env'],
    }),
    AppConfigModule,
    DatabaseModule,
    HealthModule,
    RoomsModule,
    RealtimeModule,
    WordsModule,
  ],
})
export class AppModule {}
