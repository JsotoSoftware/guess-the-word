import type { ReactNode } from 'react'

interface WordBoardProps {
  timerLabel?: string | null
  footer?: ReactNode
  children: ReactNode
}

interface GuessGridRowProps {
  wordLength: number
  faded?: boolean
  children: ReactNode
}

function getBoardMetrics(wordLength: number) {
  const idealSize = wordLength <= 5 ? 76 : wordLength <= 7 ? 66 : wordLength <= 9 ? 56 : 48
  const gap = wordLength <= 7 ? 10 : 8
  const maxWidth = wordLength * idealSize + Math.max(wordLength - 1, 0) * gap
  const gapClass = gap === 10 ? 'gap-1.5 sm:gap-2.5' : 'gap-1 sm:gap-2'

  return { maxWidth, gapClass }
}

export function getResponsiveLetterBoxClassName(wordLength: number): string {
  if (wordLength <= 5) {
    return 'aspect-square h-auto w-full rounded-[18px] text-[clamp(1.5rem,5.3vw,2.2rem)]'
  }

  if (wordLength <= 7) {
    return 'aspect-square h-auto w-full rounded-[17px] text-[clamp(1.3rem,4.8vw,1.95rem)]'
  }

  if (wordLength <= 9) {
    return 'aspect-square h-auto w-full rounded-[16px] text-[clamp(1.12rem,4.15vw,1.58rem)]'
  }

  return 'aspect-square h-auto w-full rounded-[14px] text-[clamp(1rem,3.55vw,1.3rem)]'
}

export function GuessGridRow({ wordLength, faded = false, children }: GuessGridRowProps) {
  const { maxWidth, gapClass } = getBoardMetrics(wordLength)

  return (
    <div
      className={`mx-auto grid w-full ${gapClass} ${faded ? 'opacity-75' : ''}`}
      style={{
        maxWidth,
        gridTemplateColumns: `repeat(${wordLength}, minmax(0, 1fr))`,
      }}
    >
      {children}
    </div>
  )
}

export function WordBoard({ timerLabel, footer, children }: WordBoardProps) {
  return (
    <div className="rounded-[28px] border border-[#6264c2] bg-gradient-to-b from-[#6769be] via-[#5a5db1] to-[#4e509d] p-1.5 shadow-[0_18px_40px_rgba(46,33,112,0.35)] sm:rounded-[32px] sm:border-[5px] sm:border-[#6c6dd0] sm:from-[#7072c7] sm:via-[#6163b8] sm:to-[#4e509d] sm:p-5">
      <div className="rounded-[20px] border border-[#6668c7] bg-[#4e509d] p-1 shadow-[inset_0_-6px_0_rgba(46,33,112,0.28)] sm:rounded-[24px] sm:border-[4px] sm:border-[#7475d7] sm:bg-[#4e509d] sm:p-5">
        {timerLabel ? (
          <div className="mb-3 flex justify-center sm:mb-4">
            <span className="rounded-full border border-[#3048a8]/70 bg-[#fef3c7] px-3 py-1.5 text-sm font-black text-[#3048a8] shadow-[inset_0_-2px_0_rgba(180,142,41,0.25)] sm:px-4 sm:py-2 sm:text-base">
              ⏱️ {timerLabel}
            </span>
          </div>
        ) : null}

        <div className="space-y-3">{children}</div>

        {footer ? <div className="mt-4 sm:mt-5">{footer}</div> : null}
      </div>
    </div>
  )
}
