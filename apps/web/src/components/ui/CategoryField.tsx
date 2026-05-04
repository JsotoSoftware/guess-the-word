import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import type { AvailableWordCategory } from '../../lib/word-categories'

interface CategoryFieldProps {
  name: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSelectCategory: (category: string) => void
  availableCategories: AvailableWordCategory[]
  isLoading: boolean
  error: string | null
  labelClassName?: string
  inputClassName: string
  helperClassName?: string
  placeholder?: string
}

export function CategoryField({
  name,
  value,
  onChange,
  onSelectCategory,
  availableCategories,
  isLoading,
  error,
  labelClassName = 'font-medium text-white',
  inputClassName,
  helperClassName = 'text-xs leading-5 text-slate-400',
  placeholder = 'Ej. anime, videojuegos, comida',
}: CategoryFieldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const listboxId = useId()
  const normalizedValue = value.trim().toLowerCase()

  const visibleCategories = useMemo(() => {
    if (!normalizedValue) {
      return availableCategories
    }

    return availableCategories.filter((entry) => entry.category.includes(normalizedValue))
  }, [availableCategories, normalizedValue])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [normalizedValue, visibleCategories.length])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setIsOpen(true)
    onChange(event)
  }

  const handleSelectCategory = (category: string) => {
    onSelectCategory(category)
    setIsOpen(false)
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      setIsOpen(true)
      return
    }

    if (!isOpen || visibleCategories.length === 0) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((currentIndex) => Math.min(currentIndex + 1, visibleCategories.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((currentIndex) => Math.max(currentIndex - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      const highlightedCategory = visibleCategories[highlightedIndex]

      if (highlightedCategory) {
        event.preventDefault()
        handleSelectCategory(highlightedCategory.category)
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <label className="block space-y-2">
      <span className={labelClassName}>Categoría</span>

      <div ref={containerRef} className="relative">
        <input
          name={name}
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={isOpen && visibleCategories[highlightedIndex] ? `${listboxId}-${highlightedIndex}` : undefined}
          className={`${inputClassName} pr-12`}
        />

        <button
          type="button"
          onClick={() => setIsOpen((currentValue) => !currentValue)}
          className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-white"
          aria-label={isOpen ? 'Cerrar categorías' : 'Abrir categorías'}
        >
          <span className={`text-sm transition ${isOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {isOpen ? (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur"
          >
            <button
              type="button"
              onClick={() => handleSelectCategory('general')}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${normalizedValue === 'general'
                ? 'bg-brand-400/18 text-brand-50'
                : 'text-slate-200 hover:bg-white/8 hover:text-white'
              }`}
            >
              <span className="font-semibold">general</span>
              <span className="text-xs text-slate-400">predeterminada</span>
            </button>

            {visibleCategories.length > 0 ? (
              <div className="mt-2 space-y-1">
                {visibleCategories.map((entry, index) => {
                  const isSelected = entry.category === normalizedValue
                  const isHighlighted = index === highlightedIndex

                  return (
                    <button
                      key={entry.category}
                      id={`${listboxId}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => handleSelectCategory(entry.category)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${isSelected || isHighlighted
                        ? 'bg-brand-400/18 text-brand-50'
                        : 'text-slate-200 hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      <span className="font-semibold">{entry.category}</span>
                      <span className="text-xs text-slate-400">{entry.count}</span>
                    </button>
                  )
                })}
              </div>
            ) : !isLoading ? (
              <p className="mt-2 rounded-xl px-3 py-2 text-sm text-slate-400">
                No hay coincidencias para la búsqueda actual.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {isLoading ? <p className={helperClassName}>Cargando categorías disponibles...</p> : null}
      {!isLoading && error ? <p className={helperClassName}>{error}</p> : null}
      {!isLoading && !error ? (
        <p className={helperClassName}>
          {availableCategories.length > 0
            ? `${availableCategories.length} categorías disponibles. Si lo dejas vacío se usa general.`
            : 'No hay categorías disponibles para los filtros actuales. Si lo dejas vacío se usa general.'}
        </p>
      ) : null}
    </label>
  )
}
