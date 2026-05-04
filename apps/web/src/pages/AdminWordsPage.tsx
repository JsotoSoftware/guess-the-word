import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { SectionCard } from '../components/ui/SectionCard'
import { env } from '../lib/env'

type WordActivityFilter = 'all' | 'active' | 'inactive'

interface AdminWordRecord {
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

interface FiltersFormState {
  length: string
  language: string
  difficulty: string
  category: string
  activity: WordActivityFilter
}

const initialFilters: FiltersFormState = {
  length: '',
  language: '',
  difficulty: '',
  category: '',
  activity: 'all',
}

function buildWordsUrl(filters: FiltersFormState): string {
  const url = new URL('/words', env.apiUrl)

  if (filters.length.trim()) {
    url.searchParams.set('length', filters.length.trim())
  }

  if (filters.language.trim()) {
    url.searchParams.set('language', filters.language.trim().toLowerCase())
  }

  if (filters.difficulty.trim()) {
    url.searchParams.set('difficulty', filters.difficulty.trim().toLowerCase())
  }

  if (filters.category.trim()) {
    url.searchParams.set('category', filters.category.trim().toLowerCase())
  }

  url.searchParams.set('activity', filters.activity)

  return url.toString()
}

async function readApiError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { message?: string | string[] }
    const message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message
    return message || 'La solicitud no se pudo completar.'
  } catch {
    return 'La solicitud no se pudo completar.'
  }
}

export function AdminWordsPage() {
  const [filters, setFilters] = useState<FiltersFormState>(initialFilters)
  const [appliedFilters, setAppliedFilters] = useState<FiltersFormState>(initialFilters)
  const [words, setWords] = useState<AdminWordRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [pendingWordIds, setPendingWordIds] = useState<string[]>([])

  const loadWords = useCallback(async (nextFilters: FiltersFormState, signal?: AbortSignal) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(buildWordsUrl(nextFilters), {
        method: 'GET',
        signal,
      })

      if (!response.ok) {
        throw new Error(await readApiError(response))
      }

      const payload = await response.json() as AdminWordRecord[]
      setWords(payload)
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return
      }

      setError(fetchError instanceof Error ? fetchError.message : 'No se pudieron cargar las palabras.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadWords(appliedFilters, controller.signal)
    return () => controller.abort()
  }, [appliedFilters, loadWords])

  const handleFilterChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const handleApplyFilters = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActionMessage(null)
    setAppliedFilters(filters)
  }

  const handleResetFilters = () => {
    setActionMessage(null)
    setFilters(initialFilters)
    setAppliedFilters(initialFilters)
  }

  const handleToggleWord = async (word: AdminWordRecord) => {
    setActionMessage(null)
    setError(null)
    setPendingWordIds((current) => [...current, word.id])

    try {
      const response = await fetch(new URL(`/words/${word.id}/activation`, env.apiUrl), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !word.is_active }),
      })

      if (!response.ok) {
        throw new Error(await readApiError(response))
      }

      const updatedWord = await response.json() as AdminWordRecord
      setActionMessage(`Palabra ${updatedWord.word.toUpperCase()} ${updatedWord.is_active ? 'activada' : 'desactivada'} correctamente.`)
      await loadWords(appliedFilters)
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'No se pudo actualizar la palabra.')
    } finally {
      setPendingWordIds((current) => current.filter((wordId) => wordId !== word.id))
    }
  }

  const stats = useMemo(() => ({
    total: words.length,
    active: words.filter((word) => word.is_active).length,
    inactive: words.filter((word) => !word.is_active).length,
  }), [words])

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-brand-400/20 bg-gradient-to-br from-brand-500/10 via-slate-900 to-slate-950 p-8 shadow-glow">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-brand-200">
            Admin · fase 8.2
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-300">
            API words management
          </span>
        </div>
        <h2 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-white">Activar y desactivar palabras del banco de juego.</h2>
        <p className="mt-4 max-w-3xl text-base text-slate-300">
          Esta vista administrativa usa la API del backend para inspeccionar el dataset actual, aplicar filtros y cambiar el estado activo de cada palabra sin tocar la base manualmente.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <SectionCard title="Filtros" description="Consulta palabras por longitud, idioma, dificultad, categoría o estado de activación.">
          <form className="space-y-4" onSubmit={handleApplyFilters}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm text-slate-300">
                <span className="font-medium text-white">Longitud</span>
                <input
                  min={1}
                  type="number"
                  name="length"
                  value={filters.length}
                  onChange={handleFilterChange}
                  placeholder="Ej. 5"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none transition focus:border-brand-400"
                />
              </label>

              <label className="block space-y-2 text-sm text-slate-300">
                <span className="font-medium text-white">Estado</span>
                <select
                  name="activity"
                  value={filters.activity}
                  onChange={handleFilterChange}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none transition focus:border-brand-400"
                >
                  <option value="all">Todas</option>
                  <option value="active">Solo activas</option>
                  <option value="inactive">Solo inactivas</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block space-y-2 text-sm text-slate-300">
                <span className="font-medium text-white">Idioma</span>
                <input
                  name="language"
                  value={filters.language}
                  onChange={handleFilterChange}
                  placeholder="Ej. es"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none transition focus:border-brand-400"
                />
              </label>

              <label className="block space-y-2 text-sm text-slate-300">
                <span className="font-medium text-white">Dificultad</span>
                <input
                  name="difficulty"
                  value={filters.difficulty}
                  onChange={handleFilterChange}
                  placeholder="Ej. facil"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none transition focus:border-brand-400"
                />
              </label>

              <label className="block space-y-2 text-sm text-slate-300">
                <span className="font-medium text-white">Categoría</span>
                <input
                  name="category"
                  value={filters.category}
                  onChange={handleFilterChange}
                  placeholder="Ej. general"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none transition focus:border-brand-400"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-full bg-brand-500 px-5 py-3 font-medium text-white transition hover:bg-brand-400"
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-full border border-white/10 px-5 py-3 font-medium text-slate-200 transition hover:border-brand-400 hover:text-white"
              >
                Limpiar filtros
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Resumen" description="Vista rápida del lote actualmente cargado con los filtros activos.">
          <div className="grid gap-4 sm:grid-cols-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-4">
              <p className="text-slate-500">Total visibles</p>
              <p className="mt-2 text-2xl font-semibold text-white">{stats.total}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-4">
              <p className="text-slate-500">Activas</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-300">{stats.active}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-4">
              <p className="text-slate-500">Inactivas</p>
              <p className="mt-2 text-2xl font-semibold text-amber-300">{stats.inactive}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
            Endpoint usado: <span className="font-mono text-slate-200">{env.apiUrl}/words</span>
          </div>
        </SectionCard>
      </div>

      {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      {actionMessage ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{actionMessage}</div> : null}

      <SectionCard title="Palabras" description="Cada fila permite alternar la disponibilidad real del dataset usado por el juego.">
        {loading ? (
          <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-6 text-sm text-slate-300">Cargando palabras...</div>
        ) : words.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-6 text-sm text-slate-300">No hay palabras que coincidan con los filtros actuales.</div>
        ) : (
          <div className="space-y-3">
            {words.map((word) => {
              const isPending = pendingWordIds.includes(word.id)

              return (
                <div key={word.id} className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-4 text-sm text-slate-300">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-white">{word.word.toUpperCase()}</p>
                        <span className={`rounded-full border px-3 py-1 text-xs ${word.is_active ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/30 bg-amber-500/10 text-amber-200'}`}>
                          {word.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                        <span className="rounded-full border border-white/10 px-3 py-1">ID: {word.id.slice(0, 8)}…</span>
                        <span className="rounded-full border border-white/10 px-3 py-1">Idioma: {word.language}</span>
                        <span className="rounded-full border border-white/10 px-3 py-1">Longitud: {word.length}</span>
                        <span className="rounded-full border border-white/10 px-3 py-1">Dificultad: {word.difficulty ?? '—'}</span>
                        <span className="rounded-full border border-white/10 px-3 py-1">Categoría: {word.category ?? '—'}</span>
                      </div>
                      <p className="text-xs text-slate-500">Creada: {new Date(word.created_at).toLocaleString()}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleToggleWord(word)}
                      disabled={isPending}
                      className={`rounded-full px-5 py-3 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${word.is_active ? 'bg-amber-500 hover:bg-amber-400' : 'bg-emerald-500 hover:bg-emerald-400'}`}
                    >
                      {isPending
                        ? 'Actualizando...'
                        : word.is_active
                          ? 'Desactivar'
                          : 'Activar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
