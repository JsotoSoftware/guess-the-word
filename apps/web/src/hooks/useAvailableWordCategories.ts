import { useEffect, useState } from 'react'
import { type AvailableWordCategory, fetchAvailableWordCategories } from '../lib/word-categories'

export function useAvailableWordCategories(maxWordLength = '') {
  const [availableCategories, setAvailableCategories] = useState<AvailableWordCategory[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setIsLoadingCategories(true)
    setCategoriesError(null)

    fetchAvailableWordCategories({ maxWordLength }, controller.signal)
      .then((categories) => {
        setAvailableCategories(categories)
        setCategoriesError(null)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setAvailableCategories([])
        setCategoriesError(error instanceof Error ? error.message : 'No se pudieron cargar las categorías disponibles.')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingCategories(false)
        }
      })

    return () => controller.abort()
  }, [maxWordLength])

  return {
    availableCategories,
    isLoadingCategories,
    categoriesError,
  }
}
