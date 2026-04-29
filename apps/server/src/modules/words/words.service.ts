import { Injectable } from '@nestjs/common'
import { WordsRepository } from './words.repository'

@Injectable()
export class WordsService {
  constructor(private readonly wordsRepository: WordsRepository) {}

  async getWordsSummary(length: number) {
    const activeWordCount = await this.wordsRepository.countActiveWords()
    const sample = await this.wordsRepository.getRandomActiveWordByLength(length)

    return {
      requestedLength: length,
      activeWordCount,
      sample,
    }
  }
}
