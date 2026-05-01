import { Injectable } from '@nestjs/common'
import { sql } from 'slonik'
import { DatabaseService } from '../../db/database.service'
import type { AvailableWordLength, SecretWordFilters, WordActivityState, WordRecord } from './words.types'

@Injectable()
export class WordsRepository {
  constructor(private readonly database: DatabaseService) {}

  private buildFilterConditions(filters: SecretWordFilters, activityState: WordActivityState = 'active') {
    const conditions = [] as ReturnType<typeof sql.fragment>[]

    if (activityState === 'active') {
      conditions.push(sql.fragment`is_active = TRUE`)
    } else if (activityState === 'inactive') {
      conditions.push(sql.fragment`is_active = FALSE`)
    }

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

    if (conditions.length === 0) {
      return sql.fragment`TRUE`
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

  async listWords(filters: SecretWordFilters = {}, activityState: WordActivityState = 'all'): Promise<WordRecord[]> {
    const pool = await this.database.getPool()
    const whereClause = this.buildFilterConditions(filters, activityState)

    const rows = await pool.any(sql.unsafe`
      SELECT id, word, language, difficulty, category, length, is_active, created_at
      FROM words
      WHERE ${whereClause}
      ORDER BY language ASC, length ASC, word ASC
    `)

    return rows as WordRecord[]
  }

  async setWordActiveStateById(wordId: string, isActive: boolean): Promise<WordRecord | null> {
    const pool = await this.database.getPool()

    const word = await pool.maybeOne(sql.unsafe`
      UPDATE words
      SET is_active = ${isActive}
      WHERE id = ${wordId}
      RETURNING id, word, language, difficulty, category, length, is_active, created_at
    `)

    return word as WordRecord | null
  }
}
