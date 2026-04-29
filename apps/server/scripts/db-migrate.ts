import { createScriptPool, ensureMigrationsTable, executeSqlBatch, getAppliedMigrationNames, getMigrationsDirectory, readSqlFiles } from './_db'
import { sql } from 'slonik'

async function run() {
  const pool = await createScriptPool()

  try {
    const migrationFiles = await readSqlFiles(getMigrationsDirectory())

    await pool.transaction(async (transaction) => {
      await ensureMigrationsTable(transaction)

      const appliedMigrationNames = await getAppliedMigrationNames(transaction)
      const pendingMigrations = migrationFiles.filter((file) => !appliedMigrationNames.includes(file.name))

      if (pendingMigrations.length === 0) {
        console.log('No pending migrations.')
        return
      }

      for (const migration of pendingMigrations) {
        await executeSqlBatch(transaction, migration.sql)
        await transaction.query(sql.unsafe`
          INSERT INTO schema_migrations (name)
          VALUES (${migration.name})
        `)
        console.log(`Applied migration: ${migration.name}`)
      }
    })
  } finally {
    await pool.end()
  }
}

run().catch((error: unknown) => {
  console.error('Migration failed.')
  console.error(error)
  process.exitCode = 1
})
