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
  green: 'border-emerald-600 bg-emerald-300 text-emerald-950 shadow-[inset_0_-4px_0_rgba(6,78,59,0.25)]',
  yellow: 'border-amber-500 bg-amber-300 text-amber-950 shadow-[inset_0_-4px_0_rgba(146,64,14,0.25)]',
  red: 'border-rose-600 bg-rose-300 text-rose-950 shadow-[inset_0_-4px_0_rgba(136,19,55,0.22)]',
}

export const LetterBox = forwardRef<HTMLInputElement, LetterBoxProps>(function LetterBox(
  { value, feedback, disabled = false, autoFocus = false, onChange, onKeyDown },
  ref,
) {
  const colorClass = feedback
    ? feedbackClasses[feedback]
    : value.trim().length > 0
      ? 'border-[#5f64c7] bg-[#ffd0c4] text-[#3e3b8f] shadow-[inset_0_-4px_0_rgba(190,113,122,0.32)]'
      : 'border-[#5360be] bg-[#fff4e7] text-[#4b4f98] shadow-[inset_0_-4px_0_rgba(216,197,172,0.7)]'

  return (
    <input
      ref={ref}
      autoFocus={autoFocus}
      value={value}
      disabled={disabled}
      maxLength={1}
      onChange={(event) => onChange?.(event.target.value)}
      onKeyDown={onKeyDown}
      className={`h-14 w-14 rounded-[14px] border-[3px] text-center text-[1.45rem] font-black uppercase leading-none tracking-[0.08em] outline-none transition focus:border-[#ffd34f] focus:ring-4 focus:ring-[#ffd34f]/30 disabled:cursor-not-allowed ${colorClass}`}
      style={{
        fontFamily: 'Trebuchet MS, Nunito, ui-sans-serif, system-ui, sans-serif',
        textShadow: '0 1px 0 rgba(255,255,255,0.25)',
      }}
    />
  )
})
