export interface WordRecord {
  id: string
  word: string
  language: string
  difficulty: string | null
  category: string | null
  hint: string | null
  length: number
  is_active: boolean
  created_at: string
}

export interface SecretWordFilters {
  length?: number
  maxLength?: number
  language?: string
  difficulty?: string
  category?: string
  excludeWords?: string[]
}

export type WordActivityState = 'active' | 'inactive' | 'all'

export interface WordImportRecord {
  word: string
  language: string
  difficulty: string | null
  category: string | null
  hint: string | null
  length: number
  isActive: boolean
}

export interface AvailableWordLength {
  length: number
  count: number
}

export interface AvailableWordCategory {
  category: string
  count: number
}
