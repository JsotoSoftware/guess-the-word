import path from 'node:path'
import type { WordImportRecord } from './words.types'

interface WordImportObjectEntry {
  word?: unknown
  language?: unknown
  difficulty?: unknown
  category?: unknown
  hint?: unknown
  isActive?: unknown
}

export interface WordImportDefaults {
  language?: string
  difficulty?: string | null
  category?: string | null
  isActive?: boolean
}

function normalizeWord(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Cada palabra importada debe ser un texto.')
  }

  const normalizedWord = value.trim().toLowerCase()

  if (!normalizedWord) {
    throw new Error('No se pueden importar palabras vacías.')
  }

  if (!/^\p{L}+$/u.test(normalizedWord)) {
    throw new Error(`La palabra ${normalizedWord} contiene caracteres no permitidos.`)
  }

  return normalizedWord
}

function normalizeOptionalText(value: unknown, fallback: string | null): string | null {
  if (value === undefined) {
    return fallback
  }

  if (value === null) {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error('Los metadatos de palabra deben ser textos o null.')
  }

  const normalizedValue = value.trim().toLowerCase()
  return normalizedValue || null
}

function normalizeOptionalHint(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error('La pista de la palabra debe ser un texto o null.')
  }

  const normalizedHint = value.trim()
  return normalizedHint || null
}

function normalizeLanguage(value: unknown, fallback: string): string {
  if (value === undefined) {
    return fallback
  }

  if (typeof value !== 'string') {
    throw new Error('El idioma de la palabra debe ser un texto.')
  }

  const normalizedLanguage = value.trim().toLowerCase()

  if (!normalizedLanguage) {
    throw new Error('El idioma de la palabra no puede estar vacío.')
  }

  return normalizedLanguage
}

function normalizeIsActive(value: unknown, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback
  }

  if (typeof value !== 'boolean') {
    throw new Error('El campo isActive debe ser booleano cuando se informa en un JSON.')
  }

  return value
}

function toWordImportRecord(entry: string | WordImportObjectEntry, defaults: Required<WordImportDefaults>): WordImportRecord {
  if (typeof entry === 'string') {
    const word = normalizeWord(entry)

    return {
      word,
      language: defaults.language,
      difficulty: defaults.difficulty,
      category: defaults.category,
      hint: null,
      length: Array.from(word).length,
      isActive: defaults.isActive,
    }
  }

  const word = normalizeWord(entry.word)

  return {
    word,
    language: normalizeLanguage(entry.language, defaults.language),
    difficulty: normalizeOptionalText(entry.difficulty, defaults.difficulty),
    category: normalizeOptionalText(entry.category, defaults.category),
    hint: normalizeOptionalHint(entry.hint),
    length: Array.from(word).length,
    isActive: normalizeIsActive(entry.isActive, defaults.isActive),
  }
}

function dedupeWords(words: WordImportRecord[]): WordImportRecord[] {
  const uniqueWords = new Map<string, WordImportRecord>()

  for (const word of words) {
    uniqueWords.set(`${word.language}:${word.word}`, word)
  }

  return [...uniqueWords.values()].sort((left, right) => (
    left.language.localeCompare(right.language)
    || left.word.localeCompare(right.word)
  ))
}

function parseTextWordList(rawContent: string, defaults: Required<WordImportDefaults>): WordImportRecord[] {
  const entries = rawContent
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))

  return dedupeWords(entries.map((entry) => toWordImportRecord(entry, defaults)))
}

function parseJsonWordList(rawContent: string, defaults: Required<WordImportDefaults>): WordImportRecord[] {
  const parsedContent = JSON.parse(rawContent) as unknown

  if (!Array.isArray(parsedContent)) {
    throw new Error('El archivo JSON de importación debe contener un arreglo.')
  }

  return dedupeWords(parsedContent.map((entry) => toWordImportRecord(entry as string | WordImportObjectEntry, defaults)))
}

export function parseImportedWordsFile(
  filePath: string,
  rawContent: string,
  defaults: WordImportDefaults = {},
): WordImportRecord[] {
  const normalizedDefaults: Required<WordImportDefaults> = {
    language: normalizeLanguage(defaults.language, 'es'),
    difficulty: normalizeOptionalText(defaults.difficulty, null),
    category: normalizeOptionalText(defaults.category, null),
    isActive: defaults.isActive ?? true,
  }

  const extension = path.extname(filePath).toLowerCase()

  if (extension === '.txt') {
    return parseTextWordList(rawContent, normalizedDefaults)
  }

  if (extension === '.json') {
    return parseJsonWordList(rawContent, normalizedDefaults)
  }

  throw new Error('Formato de importación no soportado. Usa .txt o .json.')
}
