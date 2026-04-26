import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get port(): number {
    return Number(this.configService.get<string>('PORT') ?? 3000)
  }

  get clientUrl(): string {
    return this.configService.get<string>('CLIENT_URL') ?? 'http://localhost:5173'
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV') ?? 'development'
  }
}
