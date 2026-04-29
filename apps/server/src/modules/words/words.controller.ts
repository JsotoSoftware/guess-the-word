import { Controller, Get, Query } from '@nestjs/common'
import { WordsService } from './words.service'

interface WordsSummaryResponse {
  requestedLength: number
  activeWordCount: number
  sample: {
    id: string
    word: string
    language: string
    difficulty: string | null
    category: string | null
    length: number
    is_active: boolean
    created_at: string
  } | null
}

@Controller('words')
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Get('summary')
  getWordsSummary(@Query('length') length?: string): Promise<WordsSummaryResponse> {
    const parsedLength = Number(length)
    const safeLength = Number.isInteger(parsedLength) && parsedLength > 0 ? parsedLength : 5

    return this.wordsService.getWordsSummary(safeLength)
  }
}
