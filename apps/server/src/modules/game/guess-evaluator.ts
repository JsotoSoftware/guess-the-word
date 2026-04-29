import type { LetterFeedback, LetterResult } from '@guess-the-word/shared'

export class InvalidGuessLengthError extends Error {
  constructor(expectedLength: number, receivedLength: number) {
    super(`La palabra enviada debe tener ${expectedLength} letras, pero recibió ${receivedLength}.`)
    this.name = 'InvalidGuessLengthError'
  }
}

export interface GuessEvaluation {
  secretWord: string
  guess: string
  letters: LetterResult[]
  isCorrect: boolean
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase()
}

export function evaluateGuess(secretWord: string, guess: string): GuessEvaluation {
  const normalizedSecretWord = normalizeWord(secretWord)
  const normalizedGuess = normalizeWord(guess)
  const secretLetters = [...normalizedSecretWord]
  const guessLetters = [...normalizedGuess]

  if (secretLetters.length !== guessLetters.length) {
    throw new InvalidGuessLengthError(secretLetters.length, guessLetters.length)
  }

  const feedback: LetterFeedback[] = Array.from({ length: guessLetters.length }, () => 'red')
  const remainingLetterCounts = new Map<string, number>()

  for (let index = 0; index < secretLetters.length; index += 1) {
    if (guessLetters[index] === secretLetters[index]) {
      feedback[index] = 'green'
      continue
    }

    const secretLetter = secretLetters[index]
    remainingLetterCounts.set(secretLetter, (remainingLetterCounts.get(secretLetter) ?? 0) + 1)
  }

  for (let index = 0; index < guessLetters.length; index += 1) {
    if (feedback[index] === 'green') {
      continue
    }

    const guessLetter = guessLetters[index]
    const remainingCount = remainingLetterCounts.get(guessLetter) ?? 0

    if (remainingCount > 0) {
      feedback[index] = 'yellow'
      remainingLetterCounts.set(guessLetter, remainingCount - 1)
    }
  }

  const letters: LetterResult[] = guessLetters.map((letter, index) => ({
    letter,
    feedback: feedback[index],
  }))

  return {
    secretWord: normalizedSecretWord,
    guess: normalizedGuess,
    letters,
    isCorrect: letters.every((letter) => letter.feedback === 'green'),
  }
}
