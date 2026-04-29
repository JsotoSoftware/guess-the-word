import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import dotenv from 'dotenv'
import { createPool, sql, type DatabasePool, type DatabasePoolConnection } from 'slonik'
import { unsafeRawSql } from '../src/db/sql.util'

export interface SqlFile {
  name: string
  sql: string
}

dotenv.config()

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required. Create apps/server/.env or export DATABASE_URL before running database scripts.')
  }

  return databaseUrl
}

export async function createScriptPool(): Promise<DatabasePool> {
  return createPool(getDatabaseUrl())
}

export async function readSqlFiles(directoryPath: string): Promise<SqlFile[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  const sqlFiles = await Promise.all(
    files.map(async (fileName) => ({
      name: fileName,
      sql: await readFile(path.join(directoryPath, fileName), 'utf8'),
    })),
  )

  return sqlFiles
}

export function getMigrationsDirectory(): string {
  return path.join(process.cwd(), 'db', 'migrations')
}

export function getSeedsDirectory(): string {
  return path.join(process.cwd(), 'db', 'seeds')
}

export async function ensureMigrationsTable(connection: DatabasePoolConnection): Promise<void> {
  await connection.query(sql.unsafe`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

export async function getAppliedMigrationNames(connection: DatabasePoolConnection): Promise<string[]> {
  const rows = await connection.anyFirst(sql.unsafe`
    SELECT name
    FROM schema_migrations
    ORDER BY id ASC
  `)

  return rows.map((row) => String(row))
}

function splitSqlStatements(rawSql: string): string[] {
  const statements: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let inLineComment = false
  let inBlockComment = false

  for (let index = 0; index < rawSql.length; index += 1) {
    const char = rawSql[index]
    const nextChar = rawSql[index + 1]

    if (inLineComment) {
      current += char
      if (char === '\n') {
        inLineComment = false
      }
      continue
    }

    if (inBlockComment) {
      current += char
      if (char === '*' && nextChar === '/') {
        current += nextChar
        index += 1
        inBlockComment = false
      }
      continue
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '-' && nextChar === '-') {
        current += char + nextChar
        index += 1
        inLineComment = true
        continue
      }

      if (char === '/' && nextChar === '*') {
        current += char + nextChar
        index += 1
        inBlockComment = true
        continue
      }
    }

    if (char === "'" && !inDoubleQuote) {
      current += char
      if (inSingleQuote && nextChar === "'") {
        current += nextChar
        index += 1
        continue
      }
      inSingleQuote = !inSingleQuote
      continue
    }

    if (char === '"' && !inSingleQuote) {
      current += char
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      const statement = current.trim()
      if (statement) {
        statements.push(statement)
      }
      current = ''
      continue
    }

    current += char
  }

  const finalStatement = current.trim()
  if (finalStatement) {
    statements.push(finalStatement)
  }

  return statements
}

export async function executeSqlBatch(connection: DatabasePoolConnection, rawSql: string): Promise<void> {
  const statements = splitSqlStatements(rawSql)

  for (const statement of statements) {
    await connection.query(unsafeRawSql(statement))
  }
}
