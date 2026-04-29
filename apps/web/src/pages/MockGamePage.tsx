import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { LetterResult } from '@guess-the-word/shared'
import { SectionCard } from '../components/ui/SectionCard'
import { LetterBox } from '../components/game/LetterBox'
import { evaluateMockGuess } from '../lib/mock-guess-evaluator'

const SECRET_WORD = 'quejese'
const TOTAL_ATTEMPTS = 5

interface GuessRowState {
  guess: string
  letters: LetterResult[]
}

function createEmptyLetters(length: number) {
  return Array.from({ length }, () => '')
}

function sanitizeLetter(value: string): string {
  const lettersOnly = Array.from(value).filter((character) => /\p{L}/u.test(character))
  const lastLetter = lettersOnly[lettersOnly.length - 1] ?? ''
  return lastLetter.toLowerCase()
}

export function MockGamePage() {
  const wordLength = SECRET_WORD.length
  const [letters, setLetters] = useState<string[]>(() => createEmptyLetters(wordLength))
  const [guesses, setGuesses] = useState<GuessRowState[]>([])
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing')
  const [message, setMessage] = useState('Completa las casillas y envía tu intento.')
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  const attemptsLeft = TOTAL_ATTEMPTS - guesses.length
  const isRowComplete = letters.every((letter) => letter.length === 1)

  const emptyRows = useMemo(() => {
    const usedRows = guesses.length + (status === 'playing' ? 1 : 0)
    return Math.max(TOTAL_ATTEMPTS - usedRows, 0)
  }, [guesses.length, status])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const focusInput = (index: number) => {
    const nextInput = inputRefs.current[index]
    nextInput?.focus()
    nextInput?.select()
  }

  const updateLetterAt = (index: number, rawValue: string) => {
    if (status !== 'playing') {
      return
    }

    const nextLetter = sanitizeLetter(rawValue)

    setLetters((currentLetters) => {
      const nextLetters = [...currentLetters]
      nextLetters[index] = nextLetter
      return nextLetters
    })

    if (nextLetter && index < wordLength - 1) {
      requestAnimationFrame(() => focusInput(index + 1))
    }
  }

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !letters[index] && index > 0) {
      requestAnimationFrame(() => focusInput(index - 1))
      return
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      focusInput(index - 1)
      return
    }

    if (event.key === 'ArrowRight' && index < wordLength - 1) {
      event.preventDefault()
      focusInput(index + 1)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      submitGuess()
    }
  }

  const submitGuess = () => {
    if (status !== 'playing') {
      return
    }

    if (!isRowComplete) {
      setMessage('Debes completar todas las casillas antes de enviar el intento.')
      return
    }

    const guess = letters.join('')
    const evaluation = evaluateMockGuess(SECRET_WORD, guess)
    const nextGuesses = [...guesses, { guess: evaluation.guess, letters: evaluation.letters }]

    setGuesses(nextGuesses)

    if (evaluation.isCorrect) {
      setStatus('won')
      setMessage(`¡Correcto! Adivinaste la palabra ${evaluation.guess.toUpperCase()}.`)
      return
    }

    if (nextGuesses.length >= TOTAL_ATTEMPTS) {
      setStatus('lost')
      setMessage(`Se acabaron los intentos. La palabra oculta era ${SECRET_WORD.toUpperCase()}.`)
      return
    }

    setLetters(createEmptyLetters(wordLength))
    setMessage('Intento registrado. Sigue probando con otra palabra.')
    requestAnimationFrame(() => focusInput(0))
  }

  const resetGame = () => {
    setGuesses([])
    setLetters(createEmptyLetters(wordLength))
    setStatus('playing')
    setMessage('Completa las casillas y envía tu intento.')
    requestAnimationFrame(() => focusInput(0))
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-slate-900/85 p-8 shadow-glow">
        <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Fase 2.4</p>
        <h2 className="mt-2 text-3xl font-bold text-white">Tablero mínimo jugable con datos simulados</h2>
        <p className="mt-3 max-w-3xl text-slate-300">
          Esta pantalla permite probar localmente el tablero, las casillas por letra, los colores de retroalimentación, el conteo de intentos y los estados de victoria o derrota sin depender todavía del backend multijugador.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <SectionCard title="Tablero de prueba" description="La palabra oculta no se muestra. Solo se conoce su longitud.">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2">Letras: {wordLength}</span>
              <span className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2">Intentos restantes: {attemptsLeft}</span>
              <span className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2">
                Estado: {status === 'playing' ? 'En progreso' : status === 'won' ? 'Ganado' : 'Perdido'}
              </span>
            </div>

            <div className="rounded-[28px] border-[5px] border-[#4659ba] bg-gradient-to-b from-[#7cb3ff] via-[#66a7ff] to-[#4d87ef] p-4 shadow-[0_18px_40px_rgba(30,64,175,0.35)]">
              <div className="rounded-[22px] border-[4px] border-[#3048a8] bg-[#88b7ff] p-3 shadow-[inset_0_-6px_0_rgba(28,64,150,0.35)]">
                <div className="space-y-2.5">
                  {guesses.map((row, rowIndex) => (
                    <div key={`${row.guess}-${rowIndex}`} className="flex flex-wrap gap-2.5">
                      {row.letters.map((letter, index) => (
                        <LetterBox key={`${row.guess}-${index}`} value={letter.letter} feedback={letter.feedback} disabled />
                      ))}
                    </div>
                  ))}

                  {status === 'playing' ? (
                    <div className="flex flex-wrap gap-2.5">
                      {letters.map((letter, index) => (
                        <LetterBox
                          key={`active-${index}`}
                          value={letter}
                          autoFocus={index === 0 && guesses.length === 0}
                          ref={(element) => {
                            inputRefs.current[index] = element
                          }}
                          onChange={(value) => updateLetterAt(index, value)}
                          onKeyDown={(event) => handleKeyDown(index, event)}
                        />
                      ))}
                    </div>
                  ) : null}

                  {Array.from({ length: emptyRows }).map((_, rowIndex) => (
                    <div key={`empty-${rowIndex}`} className="flex flex-wrap gap-2.5 opacity-80">
                      {Array.from({ length: wordLength }).map((__, index) => (
                        <LetterBox key={`empty-${rowIndex}-${index}`} value="" disabled />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={submitGuess}
                disabled={status !== 'playing' || !isRowComplete}
                className="rounded-full bg-brand-500 px-5 py-3 font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                Enviar intento
              </button>
              <button
                type="button"
                onClick={resetGame}
                className="rounded-full border border-white/10 px-5 py-3 font-medium text-slate-200 transition hover:border-white/30 hover:text-white"
              >
                Reiniciar partida local
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Retroalimentación local" description="Guía visual para verificar el comportamiento esperado del tablero.">
          <div className="space-y-4 text-sm text-slate-300">
            <p className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">{message}</p>
            <ul className="space-y-3">
              <li className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-emerald-100">
                Verde: letra correcta en la posición correcta.
              </li>
              <li className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-amber-100">
                Amarillo: letra correcta en una posición incorrecta.
              </li>
              <li className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-rose-100">
                Rojo: la letra no pertenece a la palabra en la cantidad disponible.
              </li>
            </ul>
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 text-slate-400">
              <p className="font-medium text-slate-200">Cómo probar esta pantalla</p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-brand-200">Estilo visual inspirado en tableros como CodyCross</p>
              <ol className="mt-2 list-decimal space-y-2 pl-5">
                <li>Escribe una palabra de {wordLength} letras directamente en las casillas.</li>
                <li>Presiona Enter o el botón de envío.</li>
                <li>Verifica que aparezcan los colores y que bajen los intentos.</li>
                <li>Gana con la palabra correcta o agota los intentos para revisar ambos estados.</li>
              </ol>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
