import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { AppConfigService } from './config/app-config.service'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(AppConfigService)

  app.enableCors({
    origin: config.clientUrl,
    credentials: true,
  })

  const port = config.port
  await app.listen(port)

  Logger.log(`HTTP server listening on http://localhost:${port}`, 'Bootstrap')
  Logger.log(`Health endpoint available at http://localhost:${port}/health`, 'Bootstrap')
}

void bootstrap()
