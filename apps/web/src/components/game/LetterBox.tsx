import type { KeyboardEvent } from 'react'
import type { LetterFeedback } from '@guess-the-word/shared'

import { forwardRef } from 'react'

interface LetterBoxProps {
  value: string
  feedback?: LetterFeedback
  disabled?: boolean
  autoFocus?: boolean
  onChange?: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
}

const feedbackClasses: Record<LetterFeedback, string> = {
  green: 'border-emerald-500 bg-emerald-500/20 text-emerald-100',
  yellow: 'border-amber-400 bg-amber-400/20 text-amber-100',
  red: 'border-rose-500 bg-rose-500/20 text-rose-100',
}

export const LetterBox = forwardRef<HTMLInputElement, LetterBoxProps>(function LetterBox(
  { value, feedback, disabled = false, autoFocus = false, onChange, onKeyDown },
  ref,
) {
  const colorClass = feedback ? feedbackClasses[feedback] : 'border-white/10 bg-slate-950/60 text-white'

  return (
    <input
      ref={ref}
      autoFocus={autoFocus}
      value={value}
      disabled={disabled}
      maxLength={1}
      onChange={(event) => onChange?.(event.target.value)}
      onKeyDown={onKeyDown}
      className={`h-14 w-14 rounded-2xl border text-center text-xl font-bold uppercase outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-80 ${colorClass}`}
    />
  )
})
