import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateGuess, InvalidGuessLengthError } from './guess-evaluator'

test('marca todas las letras en verde cuando la palabra es correcta', () => {
  const result = evaluateGuess('queso', 'queso')

  assert.equal(result.isCorrect, true)
  assert.deepEqual(
    result.letters.map((letter) => letter.feedback),
    ['green', 'green', 'green', 'green', 'green'],
  )
})

test('marca letras correctas en posición incorrecta en amarillo', () => {
  const result = evaluateGuess('perro', 'presa')

  assert.equal(result.isCorrect, false)
  assert.deepEqual(
    result.letters.map((letter) => letter.feedback),
    ['green', 'yellow', 'yellow', 'red', 'red'],
  )
})

test('no permite usar más ocurrencias de una letra que las disponibles en la palabra secreta', () => {
  const result = evaluateGuess('queso', 'ssqqq')

  assert.deepEqual(
    result.letters.map((letter) => letter.feedback),
    ['yellow', 'red', 'yellow', 'red', 'red'],
  )
})

test('da prioridad a los verdes antes de repartir amarillos', () => {
  const result = evaluateGuess('canto', 'tacto')

  assert.deepEqual(
    result.letters.map((letter) => letter.feedback),
    ['red', 'green', 'yellow', 'green', 'green'],
  )
})

test('rechaza palabras con longitud inválida', () => {
  assert.throws(() => evaluateGuess('queso', 'sol'), InvalidGuessLengthError)
})
