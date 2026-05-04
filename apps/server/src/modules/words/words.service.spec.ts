import test from 'node:test'
import assert from 'node:assert/strict'
import { NotFoundException } from '@nestjs/common'
import { WordsService } from './words.service'
import type { WordsRepository } from './words.repository'
import type { AvailableWordLength, SecretWordFilters, WordActivityState, WordRecord } from './words.types'

type WordsRepositoryMock = Pick<
  WordsRepository,
  'countActiveWords' | 'getAvailableLengths' | 'getAvailableCategories' | 'getRandomSecretWord' | 'listWords' | 'setWordActiveStateById'
>

function createWordRecord(overrides: Partial<WordRecord> = {}): WordRecord {
  return {
    id: 'word-1',
    word: 'queso',
    language: 'es',
    difficulty: 'facil',
    category: 'general',
    hint: null,
    length: 5,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function createRepositoryMock(): WordsRepositoryMock {
  return {
    countActiveWords: async () => 0,
    getAvailableLengths: async () => [] as AvailableWordLength[],
    getAvailableCategories: async () => [],
    getRandomSecretWord: async () => null,
    listWords: async () => [] as WordRecord[],
    setWordActiveStateById: async () => null,
  }
}

test('getWordsSummary devuelve conteo, longitudes y sample del repositorio', async () => {
  const repository = createRepositoryMock()
  repository.countActiveWords = async () => 3
  repository.getAvailableLengths = async () => [{ length: 5, count: 3 }]
  repository.getRandomSecretWord = async () => createWordRecord()

  const service = new WordsService(repository as unknown as WordsRepository)
  const response = await service.getWordsSummary({ language: 'es', difficulty: 'facil' })

  assert.equal(response.activeWordCount, 3)
  assert.deepEqual(response.availableLengths, [{ length: 5, count: 3 }])
  assert.equal(response.sample?.word, 'queso')
})

test('getAvailableCategories reenvía filtros y estado de actividad al repositorio', async () => {
  const repository = createRepositoryMock()
  const calls: Array<{ filters: SecretWordFilters; activityState: WordActivityState }> = []

  repository.getAvailableCategories = async (filters: SecretWordFilters, activityState: WordActivityState) => {
    calls.push({ filters, activityState })
    return []
  }

  const service = new WordsService(repository as unknown as WordsRepository)
  await service.getAvailableCategories({ language: 'es', maxLength: 6 }, 'active')

  assert.deepEqual(calls, [
    {
      filters: { language: 'es', maxLength: 6 },
      activityState: 'active',
    },
  ])
})

test('getRandomSecretWord rechaza cuando no hay palabras activas disponibles', async () => {
  const service = new WordsService(createRepositoryMock() as unknown as WordsRepository)

  await assert.rejects(
    () => service.getRandomSecretWord({ length: 9 }),
    NotFoundException,
  )
})

test('listWords reenvía filtros y estado de actividad al repositorio', async () => {
  const repository = createRepositoryMock()
  const calls: Array<{ filters: SecretWordFilters; activityState: WordActivityState }> = []

  repository.listWords = async (filters: SecretWordFilters, activityState: WordActivityState) => {
    calls.push({ filters, activityState })
    return []
  }

  const service = new WordsService(repository as unknown as WordsRepository)
  await service.listWords({ language: 'es', category: 'general' }, 'inactive')

  assert.deepEqual(calls, [
    {
      filters: { language: 'es', category: 'general' },
      activityState: 'inactive',
    },
  ])
})

test('setWordActiveState devuelve la palabra actualizada', async () => {
  const repository = createRepositoryMock()
  repository.setWordActiveStateById = async () => createWordRecord({ is_active: false })

  const service = new WordsService(repository as unknown as WordsRepository)
  const response = await service.setWordActiveState('word-1', false)

  assert.equal(response.is_active, false)
})

test('setWordActiveState rechaza ids inexistentes', async () => {
  const service = new WordsService(createRepositoryMock() as unknown as WordsRepository)

  await assert.rejects(
    () => service.setWordActiveState('missing-word', false),
    NotFoundException,
  )
})
