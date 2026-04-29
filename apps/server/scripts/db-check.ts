import { createScriptPool } from './_db'
import { sql } from 'slonik'

async function run() {
  const pool = await createScriptPool()

  try {
    const ping = await pool.oneFirst(sql.unsafe`SELECT 1`)
    const activeWordCount = await pool.oneFirst(sql.unsafe`
      SELECT COUNT(*)::int
      FROM words
      WHERE is_active = TRUE
    `)

    console.log('Database check succeeded.')
    console.log(`Ping result: ${Number(ping)}`)
    console.log(`Active words: ${Number(activeWordCount)}`)
  } finally {
    await pool.end()
  }
}

run().catch((error: unknown) => {
  console.error('Database check failed.')
  console.error(error)
  process.exitCode = 1
})
