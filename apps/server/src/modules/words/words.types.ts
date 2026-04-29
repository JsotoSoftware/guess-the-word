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
