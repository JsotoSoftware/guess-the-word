import type { CSSProperties, KeyboardEvent } from 'react'
import type { LetterFeedback } from '@guess-the-word/shared'

import { forwardRef } from 'react'

interface LetterBoxProps {
  value: string
  feedback?: LetterFeedback
  disabled?: boolean
  autoFocus?: boolean
  onChange?: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  className?: string
  style?: CSSProperties
}

const feedbackClasses: Record<LetterFeedback, string> = {
  green: 'border-[#6fa7e8] bg-[#87bdf9] text-[#2f2378] shadow-[inset_0_-4px_0_rgba(64,108,194,0.3)]',
  yellow: 'border-[#bf6233] bg-[#d8723f] text-[#2f2378] shadow-[inset_0_-4px_0_rgba(173,89,43,0.28)]',
  red: 'border-[#cdbab0] bg-gradient-to-b from-[#f5ede6] to-[#decfc4] text-[#43338b] shadow-[inset_0_-4px_0_rgba(194,163,150,0.42)]',
}

export const LetterBox = forwardRef<HTMLInputElement, LetterBoxProps>(function LetterBox(
  { value, feedback, disabled = false, autoFocus = false, onChange, onKeyDown, className = '', style },
  ref,
) {
  const colorClass = feedback
    ? feedbackClasses[feedback]
    : value.trim().length > 0
      ? 'border-[#8b78d8] bg-gradient-to-b from-[#fff3ea] to-[#eedfd2] text-[#43338b] shadow-[inset_0_-4px_0_rgba(195,165,151,0.42)]'
      : 'border-[#cdbab0] bg-gradient-to-b from-[#f8f1ea] to-[#e5d7cb] text-[#4b4f98] shadow-[inset_0_-4px_0_rgba(216,197,172,0.55)]'

  return (
    <input
      ref={ref}
      autoFocus={autoFocus}
      value={value}
      disabled={disabled}
      maxLength={1}
      onChange={(event) => onChange?.(event.target.value)}
      onKeyDown={onKeyDown}
      className={`h-14 w-14 rounded-[14px] border-[3px] text-center text-[1.45rem] font-black uppercase leading-none tracking-[0.08em] outline-none transition focus:border-[#8ec7ff] focus:ring-4 focus:ring-[#8ec7ff]/30 disabled:cursor-not-allowed ${colorClass} ${className}`}
      style={{
        fontFamily: 'Trebuchet MS, Nunito, ui-sans-serif, system-ui, sans-serif',
        textShadow: '0 1px 0 rgba(255,255,255,0.25)',
        ...style,
      }}
    />
  )
})
