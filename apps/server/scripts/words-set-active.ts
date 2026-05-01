import { sql } from 'slonik'
import { createScriptPool } from './_db'

interface ActivationCliOptions {
  isActive: boolean
  word?: string
  language: string
  id?: string
}

function readFlagValue(args: string[], flagName: string): string | undefined {
  const flagIndex = args.indexOf(flagName)

  if (flagIndex === -1) {
    return undefined
  }

  return args[flagIndex + 1]
}

function parseBooleanFlag(value: string | undefined): boolean {
  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  throw new Error('Debes indicar --active true o --active false.')
}

function parseCliOptions(argv: string[]): ActivationCliOptions {
  const id = readFlagValue(argv, '--id')
  const word = readFlagValue(argv, '--word')?.trim().toLowerCase()
  const language = readFlagValue(argv, '--language')?.trim().toLowerCase() ?? 'es'

  if (!id && !word) {
    throw new Error('Debes indicar --id <uuid> o --word <palabra>.')
  }

  return {
    isActive: parseBooleanFlag(readFlagValue(argv, '--active')),
    id,
    word,
    language,
  }
}

async function run() {
  const options = parseCliOptions(process.argv.slice(2))
  const pool = await createScriptPool()

  try {
    const updatedWords = options.id
      ? await pool.any(sql.unsafe`
          UPDATE words
          SET is_active = ${options.isActive}
          WHERE id = ${options.id}
          RETURNING id, word, language, difficulty, category, length, is_active, created_at
        `)
      : await pool.any(sql.unsafe`
          UPDATE words
          SET is_active = ${options.isActive}
          WHERE word = ${options.word ?? ''} AND language = ${options.language}
          RETURNING id, word, language, difficulty, category, length, is_active, created_at
        `)

    if (updatedWords.length === 0) {
      throw new Error('No se encontró ninguna palabra para actualizar con los criterios indicados.')
    }

    console.log(`Se actualizaron ${updatedWords.length} palabra(s).`)
    console.table(updatedWords)
  } finally {
    await pool.end()
  }
}

run().catch((error: unknown) => {
  console.error('La actualización de activación de palabras falló.')
  console.error(error)
  process.exitCode = 1
})
