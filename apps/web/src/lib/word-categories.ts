import { env } from './env'

export interface AvailableWordCategory {
  category: string
  count: number
}

function parseOptionalPositiveInteger(value: string): number | null {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  return Number.parseInt(trimmedValue, 10)
}

export async function fetchAvailableWordCategories(
  options: { maxWordLength?: string } = {},
  signal?: AbortSignal,
): Promise<AvailableWordCategory[]> {
  const url = new URL('/words/categories', env.apiUrl)
  const maxWordLength = parseOptionalPositiveInteger(options.maxWordLength ?? '')

  if (maxWordLength !== null) {
    url.searchParams.set('maxLength', String(maxWordLength))
  }

  const response = await fetch(url, {
    method: 'GET',
    signal,
  })

  if (!response.ok) {
    throw new Error('No se pudieron cargar las categorías disponibles.')
  }

  const payload = await response.json() as unknown

  if (!Array.isArray(payload)) {
    throw new Error('La respuesta de categorías no tiene el formato esperado.')
  }

  return payload
    .filter((entry): entry is AvailableWordCategory => {
      if (!entry || typeof entry !== 'object') {
        return false
      }

      const category = Reflect.get(entry, 'category')
      const count = Reflect.get(entry, 'count')
      return typeof category === 'string' && typeof count === 'number'
    })
    .sort((left, right) => left.category.localeCompare(right.category))
}
