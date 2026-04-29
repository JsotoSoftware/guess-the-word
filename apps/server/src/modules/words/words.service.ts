import { Injectable, NotFoundException } from '@nestjs/common'
import { WordsRepository } from './words.repository'
import type { SecretWordFilters } from './words.types'

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

  async getRandomSecretWord(filters: SecretWordFilters) {
    const word = await this.wordsRepository.getRandomSecretWord(filters)

    if (!word) {
      throw new NotFoundException('No se encontró una palabra activa para los filtros solicitados.')
    }

    return word
  }
}
