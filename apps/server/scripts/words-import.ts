import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { sql } from 'slonik'
import { createScriptPool } from './_db'
import { parseImportedWordsFile } from '../src/modules/words/word-import.util'

interface ImportCliOptions {
  filePath: string
  language?: string
  difficulty?: string | null
  category?: string | null
  isActive: boolean
  dryRun: boolean
}

function readFlagValue(args: string[], flagName: string): string | undefined {
  const flagIndex = args.indexOf(flagName)

  if (flagIndex === -1) {
    return undefined
  }

  return args[flagIndex + 1]
}

function hasFlag(args: string[], flagName: string): boolean {
  return args.includes(flagName)
}

function parseCliOptions(argv: string[]): ImportCliOptions {
  const filePath = argv.find((argument) => !argument.startsWith('--'))

  if (!filePath) {
    throw new Error('Debes indicar la ruta de un archivo .txt o .json para importar palabras.')
  }

  return {
    filePath: path.resolve(process.cwd(), filePath),
    language: readFlagValue(argv, '--language'),
    difficulty: readFlagValue(argv, '--difficulty') ?? null,
    category: readFlagValue(argv, '--category') ?? null,
    isActive: !hasFlag(argv, '--inactive'),
    dryRun: hasFlag(argv, '--dry-run'),
  }
}

async function run() {
  const options = parseCliOptions(process.argv.slice(2))
  const rawContent = await readFile(options.filePath, 'utf8')
  const importedWords = parseImportedWordsFile(options.filePath, rawContent, {
    language: options.language,
    difficulty: options.difficulty,
    category: options.category,
    isActive: options.isActive,
  })

  if (importedWords.length === 0) {
    console.log('No se encontraron palabras válidas para importar.')
    return
  }

  if (options.dryRun) {
    console.log(`Dry run: ${importedWords.length} palabras listas para importar.`)
    console.table(importedWords)
    return
  }

  const pool = await createScriptPool()

  try {
    await pool.transaction(async (transaction) => {
      for (const word of importedWords) {
        await transaction.query(sql.unsafe`
          INSERT INTO words (word, language, difficulty, category, hint, length, is_active)
          VALUES (${word.word}, ${word.language}, ${word.difficulty}, ${word.category}, ${word.hint}, ${word.length}, ${word.isActive})
          ON CONFLICT (word, language) DO UPDATE SET
            difficulty = EXCLUDED.difficulty,
            category = EXCLUDED.category,
            hint = EXCLUDED.hint,
            length = EXCLUDED.length,
            is_active = EXCLUDED.is_active
        `)
      }
    })

    console.log(`Importadas o actualizadas ${importedWords.length} palabras.`)
  } finally {
    await pool.end()
  }
}

run().catch((error: unknown) => {
  console.error('La importación de palabras falló.')
  console.error(error)
  process.exitCode = 1
})
