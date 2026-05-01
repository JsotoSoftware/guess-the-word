import { BadRequestException, Body, Controller, Get, Param, Patch, Query } from '@nestjs/common'
import { WordsService } from './words.service'
import type { AvailableWordLength, SecretWordFilters, WordActivityState, WordRecord } from './words.types'

interface WordsSummaryResponse {
  filters: SecretWordFilters
  activeWordCount: number
  availableLengths: AvailableWordLength[]
  sample: WordRecord | null
}

interface SetWordActivationRequest {
  isActive: boolean
}

@Controller('words')
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  private parseFilters(query: {
    length?: string
    language?: string
    difficulty?: string
    category?: string
  }): SecretWordFilters {
    const filters: SecretWordFilters = {}

    if (query.length !== undefined) {
      const parsedLength = Number(query.length)

      if (!Number.isInteger(parsedLength) || parsedLength <= 0) {
        throw new BadRequestException('El parámetro length debe ser un entero positivo.')
      }

      filters.length = parsedLength
    }

    if (query.language?.trim()) {
      filters.language = query.language.trim().toLowerCase()
    }

    if (query.difficulty?.trim()) {
      filters.difficulty = query.difficulty.trim().toLowerCase()
    }

    if (query.category?.trim()) {
      filters.category = query.category.trim().toLowerCase()
    }

    return filters
  }

  private parseActivityState(activity?: string): WordActivityState {
    if (!activity) {
      return 'all'
    }

    if (activity === 'active' || activity === 'inactive' || activity === 'all') {
      return activity
    }

    throw new BadRequestException('El parámetro activity debe ser active, inactive o all.')
  }

  @Get()
  listWords(
    @Query('length') length?: string,
    @Query('language') language?: string,
    @Query('difficulty') difficulty?: string,
    @Query('category') category?: string,
    @Query('activity') activity?: string,
  ): Promise<WordRecord[]> {
    return this.wordsService.listWords(
      this.parseFilters({ length, language, difficulty, category }),
      this.parseActivityState(activity),
    )
  }

  @Patch(':wordId/activation')
  setWordActivation(
    @Param('wordId') wordId: string,
    @Body() body: SetWordActivationRequest,
  ): Promise<WordRecord> {
    if (typeof body?.isActive !== 'boolean') {
      throw new BadRequestException('El campo isActive debe ser booleano.')
    }

    return this.wordsService.setWordActiveState(wordId, body.isActive)
  }

  @Get('summary')
  getWordsSummary(
    @Query('length') length?: string,
    @Query('language') language?: string,
    @Query('difficulty') difficulty?: string,
    @Query('category') category?: string,
  ): Promise<WordsSummaryResponse> {
    return this.wordsService.getWordsSummary(this.parseFilters({ length, language, difficulty, category }))
  }

  @Get('random')
  getRandomWord(
    @Query('length') length?: string,
    @Query('language') language?: string,
    @Query('difficulty') difficulty?: string,
    @Query('category') category?: string,
  ): Promise<WordRecord> {
    return this.wordsService.getRandomSecretWord(this.parseFilters({ length, language, difficulty, category }))
  }
}
