import { createScriptPool, executeSqlBatch, getSeedsDirectory, readSqlFiles } from './_db'

async function run() {
  const pool = await createScriptPool()

  try {
    const seedFiles = await readSqlFiles(getSeedsDirectory())

    await pool.transaction(async (transaction) => {
      for (const seedFile of seedFiles) {
        await executeSqlBatch(transaction, seedFile.sql)
        console.log(`Executed seed: ${seedFile.name}`)
      }
    })
  } finally {
    await pool.end()
  }
}

run().catch((error: unknown) => {
  console.error('Seed failed.')
  console.error(error)
  process.exitCode = 1
})
