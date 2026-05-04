import { Injectable, NotFoundException } from '@nestjs/common'
import { WordsRepository } from './words.repository'
import type { SecretWordFilters, WordActivityState } from './words.types'

@Injectable()
export class WordsService {
  constructor(private readonly wordsRepository: WordsRepository) {}

  async getWordsSummary(filters: SecretWordFilters) {
    const activeWordCount = await this.wordsRepository.countActiveWords(filters)
    const availableLengths = await this.wordsRepository.getAvailableLengths({
      language: filters.language,
      difficulty: filters.difficulty,
      category: filters.category,
    })
    const sample = await this.wordsRepository.getRandomSecretWord(filters)

    return {
      filters,
      activeWordCount,
      availableLengths,
      sample,
    }
  }

  async getAvailableCategories(filters: SecretWordFilters, activityState: WordActivityState = 'active') {
    return this.wordsRepository.getAvailableCategories(filters, activityState)
  }

  async getRandomSecretWord(filters: SecretWordFilters) {
    const word = await this.wordsRepository.getRandomSecretWord(filters)

    if (!word) {
      throw new NotFoundException('No se encontró una palabra activa para los filtros solicitados.')
    }

    return word
  }

  async listWords(filters: SecretWordFilters, activityState: WordActivityState = 'all') {
    return this.wordsRepository.listWords(filters, activityState)
  }

  async setWordActiveState(wordId: string, isActive: boolean) {
    const word = await this.wordsRepository.setWordActiveStateById(wordId, isActive)

    if (!word) {
      throw new NotFoundException(`No existe una palabra con el id ${wordId}.`)
    }

    return word
  }
}
