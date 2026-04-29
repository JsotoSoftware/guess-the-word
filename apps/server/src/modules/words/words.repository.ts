import { Injectable } from '@nestjs/common'
import { sql } from 'slonik'
import { DatabaseService } from '../../db/database.service'
import type { WordRecord } from './words.types'

@Injectable()
export class WordsRepository {
  constructor(private readonly database: DatabaseService) {}

  async countActiveWords(): Promise<number> {
    const pool = await this.database.getPool()

    const count = await pool.oneFirst(sql.unsafe`
      SELECT COUNT(*)::int
      FROM words
      WHERE is_active = TRUE
    `)

    return Number(count)
  }

  async getRandomActiveWordByLength(length: number): Promise<WordRecord | null> {
    const pool = await this.database.getPool()

    const word = await pool.maybeOne(sql.unsafe`
      SELECT id, word, language, difficulty, category, length, is_active, created_at
      FROM words
      WHERE is_active = TRUE
        AND length = ${length}
      ORDER BY random()
      LIMIT 1
    `)

    return word as WordRecord | null
  }
}
