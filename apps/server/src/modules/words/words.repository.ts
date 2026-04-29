import { Injectable } from '@nestjs/common'
import { sql } from 'slonik'
import { DatabaseService } from '../../db/database.service'
import type { AvailableWordLength, SecretWordFilters, WordRecord } from './words.types'

@Injectable()
export class WordsRepository {
  constructor(private readonly database: DatabaseService) {}

  private buildFilterConditions(filters: SecretWordFilters) {
    const conditions = [sql.fragment`is_active = TRUE`]

    if (typeof filters.length === 'number') {
      conditions.push(sql.fragment`length = ${filters.length}`)
    }

    if (filters.language) {
      conditions.push(sql.fragment`language = ${filters.language}`)
    }

    if (filters.difficulty) {
      conditions.push(sql.fragment`difficulty = ${filters.difficulty}`)
    }

    if (filters.category) {
      conditions.push(sql.fragment`category = ${filters.category}`)
    }

    return sql.join(conditions, sql.fragment` AND `)
  }

  async countActiveWords(filters: SecretWordFilters = {}): Promise<number> {
    const pool = await this.database.getPool()
    const whereClause = this.buildFilterConditions(filters)

    const count = await pool.oneFirst(sql.unsafe`
      SELECT COUNT(*)::int
      FROM words
      WHERE ${whereClause}
    `)

    return Number(count)
  }

  async getAvailableLengths(filters: Omit<SecretWordFilters, 'length'> = {}): Promise<AvailableWordLength[]> {
    const pool = await this.database.getPool()
    const whereClause = this.buildFilterConditions(filters)

    const rows = await pool.any(sql.unsafe`
      SELECT length, COUNT(*)::int AS count
      FROM words
      WHERE ${whereClause}
      GROUP BY length
      ORDER BY length ASC
    `)

    return rows as AvailableWordLength[]
  }

  async getRandomSecretWord(filters: SecretWordFilters): Promise<WordRecord | null> {
    const pool = await this.database.getPool()
    const whereClause = this.buildFilterConditions(filters)

    const word = await pool.maybeOne(sql.unsafe`
      SELECT id, word, language, difficulty, category, length, is_active, created_at
      FROM words
      WHERE ${whereClause}
      ORDER BY random()
      LIMIT 1
    `)

    return word as WordRecord | null
  }
}
