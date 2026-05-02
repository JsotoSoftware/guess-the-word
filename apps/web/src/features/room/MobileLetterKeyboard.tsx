type MobileKeyboardLetterState = 'default' | 'present' | 'correct'

interface MobileLetterKeyboardProps {
  disabledLetters?: string[]
  letterStates?: Partial<Record<string, MobileKeyboardLetterState>>
  onLetterPress: (letter: string) => void
  onBackspace: () => void
}

const keyboardRows = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

function letterKey(letter: string, disabled: boolean, state: MobileKeyboardLetterState, onPress: (letter: string) => void) {
  const enabledClassName = state === 'correct'
    ? 'border-[#6fa7e8] bg-[#87bdf9] text-[#2f2378] shadow-[inset_0_-3px_0_rgba(64,108,194,0.24)] active:translate-y-[1px] active:shadow-[inset_0_-2px_0_rgba(64,108,194,0.2)]'
    : state === 'present'
      ? 'border-[#bf6233] bg-[#d8723f] text-[#2f2378] shadow-[inset_0_-3px_0_rgba(173,89,43,0.24)] active:translate-y-[1px] active:shadow-[inset_0_-2px_0_rgba(173,89,43,0.2)]'
      : 'border-[#726fd2] bg-[#f7efe7] text-[#352b84] shadow-[inset_0_-3px_0_rgba(194,163,150,0.32)] active:translate-y-[1px] active:shadow-[inset_0_-2px_0_rgba(194,163,150,0.26)]'

  return (
    <button
      key={letter}
      type="button"
      disabled={disabled}
      onClick={() => onPress(letter)}
      className={`flex h-[3.15rem] min-w-0 flex-1 touch-manipulation items-center justify-center rounded-[1.15rem] border px-1 text-[1.2rem] font-black uppercase transition ${disabled ? 'cursor-not-allowed border-[#8d8aa8] bg-[#cbc2bb] text-[#7a7391] opacity-60 shadow-none' : enabledClassName}`}
    >
      {letter}
    </button>
  )
}

export function MobileLetterKeyboard({ disabledLetters = [], letterStates = {}, onLetterPress, onBackspace }: MobileLetterKeyboardProps) {
  const disabledLetterSet = new Set(disabledLetters)

  return (
    <div className="rounded-[28px] border border-[#6c6dd0] bg-[#4e509d] p-2.5 shadow-[0_16px_34px_rgba(46,33,112,0.28)] lg:hidden">
      <div className="space-y-2">
        {keyboardRows.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex gap-1.25">
            {row.map((letter) => letterKey(letter, disabledLetterSet.has(letter), letterStates[letter] ?? 'default', onLetterPress))}
            {rowIndex === keyboardRows.length - 1 ? (
              <button
                type="button"
                onClick={onBackspace}
                className="flex h-[3.15rem] min-w-[78px] touch-manipulation items-center justify-center rounded-[1.15rem] border border-[#b5653a] bg-[#d8723f] px-2.5 text-[0.95rem] font-black uppercase text-[#2f2378] shadow-[inset_0_-3px_0_rgba(173,89,43,0.28)] transition active:translate-y-[1px] active:shadow-[inset_0_-2px_0_rgba(173,89,43,0.24)]"
              >
                Borrar
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
