import test from 'node:test'
import assert from 'node:assert/strict'
import { parseImportedWordsFile } from './word-import.util'

test('importa un .txt, normaliza palabras y elimina duplicados', () => {
  const words = parseImportedWordsFile('words.txt', '  Queso\n# comentario\nperro\nQUESO\n', {
    language: 'ES',
    difficulty: 'Facil',
    category: 'General',
  })

  assert.deepEqual(words, [
    {
      word: 'perro',
      language: 'es',
      difficulty: 'facil',
      category: 'general',
      length: 5,
      isActive: true,
    },
    {
      word: 'queso',
      language: 'es',
      difficulty: 'facil',
      category: 'general',
      length: 5,
      isActive: true,
    },
  ])
})

test('importa un .json con strings y objetos usando defaults y overrides', () => {
  const words = parseImportedWordsFile('words.json', JSON.stringify([
    'Bosque',
    {
      word: 'Planeta',
      difficulty: 'Medio',
      category: 'Ciencia',
      isActive: false,
    },
  ]), {
    language: 'es',
    difficulty: 'facil',
    category: 'general',
  })

  assert.deepEqual(words, [
    {
      word: 'bosque',
      language: 'es',
      difficulty: 'facil',
      category: 'general',
      length: 6,
      isActive: true,
    },
    {
      word: 'planeta',
      language: 'es',
      difficulty: 'medio',
      category: 'ciencia',
      length: 7,
      isActive: false,
    },
  ])
})

test('rechaza formatos de archivo no soportados', () => {
  assert.throws(
    () => parseImportedWordsFile('words.csv', 'word\nqueso\n'),
    /Formato de importación no soportado/,
  )
})

test('rechaza palabras con caracteres no válidos', () => {
  assert.throws(
    () => parseImportedWordsFile('words.txt', 'queso\nsol-1\n'),
    /contiene caracteres no permitidos/,
  )
})
