import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppConfigModule } from './config/app-config.module'
import { HealthModule } from './modules/health/health.module'
import { RealtimeModule } from './modules/realtime/realtime.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AppConfigModule,
    HealthModule,
    RealtimeModule,
  ],
})
export class AppModule {}
