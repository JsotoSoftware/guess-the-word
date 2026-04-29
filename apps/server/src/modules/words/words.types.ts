export interface WordRecord {
  id: string
  word: string
  language: string
  difficulty: string | null
  category: string | null
  length: number
  is_active: boolean
  created_at: string
}

export interface SecretWordFilters {
  length?: number
  language?: string
  difficulty?: string
  category?: string
}

export interface AvailableWordLength {
  length: number
  count: number
}
