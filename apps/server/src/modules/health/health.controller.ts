import { Controller, Get } from '@nestjs/common'
import { AppConfigService } from '../../config/app-config.service'

interface HealthResponse {
  status: 'ok'
  service: string
  environment: string
  timestamp: string
}

@Controller('health')
export class HealthController {
  constructor(private readonly config: AppConfigService) {}

  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'guess-the-word-server',
      environment: this.config.nodeEnv,
      timestamp: new Date().toISOString(),
    }
  }
}
