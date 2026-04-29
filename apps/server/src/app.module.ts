import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppConfigModule } from './config/app-config.module'
import { DatabaseModule } from './db/database.module'
import { HealthModule } from './modules/health/health.module'
import { RealtimeModule } from './modules/realtime/realtime.module'
import { WordsModule } from './modules/words/words.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AppConfigModule,
    DatabaseModule,
    HealthModule,
    RealtimeModule,
    WordsModule,
  ],
})
export class AppModule {}
