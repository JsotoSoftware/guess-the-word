import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { createPool, sql, type DatabasePool, type DatabasePoolConnection, type DatabaseTransactionConnection } from 'slonik'
import { AppConfigService } from '../config/app-config.service'

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name)
  private poolPromise: Promise<DatabasePool> | null = null

  constructor(private readonly config: AppConfigService) {}

  async getPool(): Promise<DatabasePool> {
    if (!this.poolPromise) {
      this.poolPromise = createPool(this.config.databaseUrl)
      this.logger.log('Created Slonik database pool')
    }

    return this.poolPromise
  }

  async ping(): Promise<boolean> {
    const pool = await this.getPool()
    const result = await pool.oneFirst(sql.unsafe`SELECT 1`)

    return Number(result) === 1
  }

  async withConnection<T>(handler: (connection: DatabasePoolConnection) => Promise<T>): Promise<T> {
    const pool = await this.getPool()
    return pool.connect(handler)
  }

  async withTransaction<T>(handler: (transaction: DatabaseTransactionConnection) => Promise<T>): Promise<T> {
    const pool = await this.getPool()
    return pool.transaction(handler)
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.poolPromise) {
      return
    }

    const pool = await this.poolPromise
    await pool.end()
    this.logger.log('Closed Slonik database pool')
  }
}
