import {
  type ActiveRoundRoomSnapshot,
  type FinalResultsRoomSnapshot,
  type GuessSubmissionMode,
  type LetterResult,
  type LobbyRoomSnapshot,
  type RoomSettings,
  type RoundSummaryRoomSnapshot,
} from '@guess-the-word/shared'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LetterBox } from '../components/game/LetterBox'
import { RoomChatDock } from '../features/room/RoomChatDock'
import { RoomIconButton } from '../features/room/RoomIconButton'
import { RoomLobbyView } from '../features/room/RoomLobbyView'
import { MobileLetterKeyboard } from '../features/room/MobileLetterKeyboard'
import { RoomPanel } from '../features/room/RoomPanel'
import { RoomStageHeader } from '../features/room/RoomStageHeader'
import { GuessGridRow, WordBoard, getResponsiveLetterBoxClassName } from '../features/room/WordBoard'
import { useChatNotifications } from '../features/room/hooks/useChatNotifications'
import { useMediaQuery } from '../features/room/hooks/useMediaQuery'
import { closeIcon, exitIcon } from '../features/room/room-icons'
import { formatConnectionState } from '../features/room/room-formatters'
import { useRoomSession } from '../contexts/room-session'

interface LobbySettingsFormState {
  mode: RoomSettings['mode']
  totalRounds: string
  attemptsPerRound: string
  pvpTimerSeconds: string
  submissionMode: GuessSubmissionMode
  maxPlayers: string
  maxWordLength: string
}

function toSettingsFormState(settings: RoomSettings): LobbySettingsFormState {
  return {
    mode: settings.mode,
    totalRounds: String(settings.totalRounds),
    attemptsPerRound: String(settings.attemptsPerRound),
    pvpTimerSeconds: settings.pvpTimerSeconds === null ? '' : String(settings.pvpTimerSeconds),
    submissionMode: settings.submissionMode,
    maxPlayers: settings.maxPlayers === null ? '' : String(settings.maxPlayers),
    maxWordLength: settings.maxWordLength === null ? '' : String(settings.maxWordLength),
  }
}

function parseOptionalPositiveInteger(value: string): number | null {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  return Number.parseInt(trimmedValue, 10)
}

function buildRoomSettings(form: LobbySettingsFormState, room: LobbyRoomSnapshot): RoomSettings {
  return {
    mode: form.mode,
    totalRounds: Number.parseInt(form.totalRounds, 10),
    attemptsPerRound: Number.parseInt(form.attemptsPerRound, 10),
    pvpTimerSeconds: form.mode === 'pvp' ? parseOptionalPositiveInteger(form.pvpTimerSeconds) : null,
    submissionMode: form.submissionMode,
    maxPlayers: parseOptionalPositiveInteger(form.maxPlayers),
    maxWordLength: parseOptionalPositiveInteger(form.maxWordLength),
    roundSummaryAutoAdvanceSeconds: room.settings.roundSummaryAutoAdvanceSeconds,
  }
}

function formatRemainingSeconds(seconds: number | null): string {
  if (seconds === null) {
    return 'Sin temporizador'
  }

  const safeSeconds = Math.max(seconds, 0)
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function buildCoopFinalMessage(roundsWon: number, roundsLost: number): string {
  if (roundsWon > roundsLost) {
    return 'Victoria del equipo'
  }

  if (roundsLost > roundsWon) {
    return 'Derrota del equipo'
  }

  return 'Resultado equilibrado'
}

function finalPlacementClasses(placement: number): string {
  if (placement === 1) {
    return 'border-yellow-300/40 bg-yellow-400/16 text-yellow-100'
  }

  if (placement === 2) {
    return 'border-slate-300/30 bg-slate-200/12 text-slate-100'
  }

  if (placement === 3) {
    return 'border-amber-700/40 bg-amber-700/18 text-amber-100'
  }

  return 'border-white/10 bg-slate-950/55 text-slate-100'
}

function createEmptyLetters(length: number): string[] {
  return Array.from({ length }, () => '')
}

function sanitizeLetter(value: string): string {
  const lettersOnly = Array.from(value).filter((character) => /\p{L}/u.test(character))
  const lastLetter = lettersOnly[lettersOnly.length - 1] ?? ''
  return lastLetter.toLowerCase()
}

function buildBoardMessage(hasAutoSend: boolean, canSubmit: boolean, isSolved: boolean, outOfAttempts: boolean): string {
  if (isSolved) {
    return 'La palabra de esta ronda ya fue resuelta.'
  }

  if (outOfAttempts) {
    return 'Se agotaron los intentos de esta ronda.'
  }

  if (!canSubmit) {
    return 'La ronda ya no acepta más intentos.'
  }

  return hasAutoSend
    ? 'Completa la fila para enviar el intento automáticamente.'
    : 'Completa la fila y usa el botón Enviar.'
}

type GameStatTone = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet'

const gameStatToneClasses: Record<GameStatTone, { shell: string; icon: string; value: string; helper: string }> = {
  blue: {
    shell: 'border-brand-300/25 bg-brand-400/12',
    icon: 'border-brand-200/25 bg-brand-300/15 text-brand-50',
    value: 'text-white',
    helper: 'text-brand-100',
  },
  emerald: {
    shell: 'border-emerald-300/25 bg-emerald-500/12',
    icon: 'border-emerald-200/25 bg-emerald-300/15 text-emerald-50',
    value: 'text-white',
    helper: 'text-emerald-100',
  },
  amber: {
    shell: 'border-amber-300/25 bg-amber-500/12',
    icon: 'border-amber-200/25 bg-amber-300/15 text-amber-50',
    value: 'text-white',
    helper: 'text-amber-100',
  },
  rose: {
    shell: 'border-rose-300/25 bg-rose-500/12',
    icon: 'border-rose-200/25 bg-rose-300/15 text-rose-50',
    value: 'text-white',
    helper: 'text-rose-100',
  },
  violet: {
    shell: 'border-violet-300/25 bg-violet-500/12',
    icon: 'border-violet-200/25 bg-violet-300/15 text-violet-50',
    value: 'text-white',
    helper: 'text-violet-100',
  },
}

interface GameStatCardProps {
  icon: string
  label: string
  value: string
  helper?: string
  tone?: GameStatTone
}

function GameStatCard({ icon, label, value, helper, tone = 'blue' }: GameStatCardProps) {
  const toneClasses = gameStatToneClasses[tone]

  return (
    <div className={`min-w-0 rounded-[28px] border px-4 py-4 shadow-[inset_0_-3px_0_rgba(15,23,42,0.18)] ${toneClasses.shell}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-white/70">{label}</p>
          <p className={`mt-3 text-[clamp(1.4rem,1.95vw,1.85rem)] font-black leading-[1.02] tracking-tight ${toneClasses.value}`}>{value}</p>
          {helper ? <p className={`mt-1 text-sm font-semibold leading-5 ${toneClasses.helper}`}>{helper}</p> : null}
        </div>
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-2xl ${toneClasses.icon}`}>{icon}</span>
      </div>
    </div>
  )
}

interface GameStatusBannerProps {
  icon: string
  title: string
  message: string
  tone?: GameStatTone
}

function GameStatusBanner({ icon, title, message, tone = 'blue' }: GameStatusBannerProps) {
  const toneClasses = gameStatToneClasses[tone]

  return (
    <div className={`rounded-[28px] border px-4 py-4 shadow-[inset_0_-3px_0_rgba(15,23,42,0.18)] ${toneClasses.shell}`}>
      <div className="flex min-w-0 items-start gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-2xl ${toneClasses.icon}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-white/70">{title}</p>
          <p className={`mt-2 break-words text-lg font-black tracking-tight ${toneClasses.value}`}>{message}</p>
        </div>
      </div>
    </div>
  )
}

function getBoardMessageIcon(hasAutoSend: boolean, canSubmit: boolean, isSolved: boolean, outOfAttempts: boolean): string {
  if (isSolved) {
    return '🎉'
  }

  if (outOfAttempts) {
    return '🫣'
  }

  if (!canSubmit) {
    return '⏸️'
  }

  return hasAutoSend ? '⚡' : '✍️'
}

function getBoardMessageTone(canSubmit: boolean, isSolved: boolean, outOfAttempts: boolean): GameStatTone {
  if (isSolved) {
    return 'emerald'
  }

  if (outOfAttempts) {
    return 'rose'
  }

  if (!canSubmit) {
    return 'amber'
  }

  return 'blue'
}

function getPlayerInitial(nickname: string) {
  return Array.from(nickname)[0]?.toUpperCase() ?? '?'
}

function getKeyboardLetterFeedbackState(guessHistory: Array<{ result: LetterResult[] }>) {
  const confirmedLetters = new Set<string>()
  const absentLetters = new Set<string>()
  const letterStates: Partial<Record<string, 'present' | 'correct'>> = {}

  for (const guessRecord of guessHistory) {
    for (const letterResult of guessRecord.result) {
      const normalizedLetter = letterResult.letter.toLowerCase()

      if (letterResult.feedback === 'green') {
        confirmedLetters.add(normalizedLetter)
        letterStates[normalizedLetter] = 'correct'
        continue
      }

      if (letterResult.feedback === 'yellow') {
        confirmedLetters.add(normalizedLetter)
        if (letterStates[normalizedLetter] !== 'correct') {
          letterStates[normalizedLetter] = 'present'
        }
        continue
      }

      absentLetters.add(normalizedLetter)
    }
  }

  const disabledLetters = [...absentLetters].filter((letter) => !confirmedLetters.has(letter))

  return {
    disabledLetters,
    letterStates,
  }
}

function getBoardClueState(guessHistory: Array<{ result: LetterResult[] }>, wordLength: number) {
  const confirmedPositionLetters = Array.from({ length: wordLength }, () => '')
  const misplacedChipEntries = new Map<string, { letter: string; position: number; firstSeenGuessIndex: number }>()
  const knownLetterCounts = new Map<string, number>()

  guessHistory.forEach((guessRecord, guessIndex) => {
    const guessKnownCounts = new Map<string, number>()

    guessRecord.result.forEach((letterResult, index) => {
      const normalizedLetter = letterResult.letter.toLowerCase()

      if (letterResult.feedback === 'green') {
        confirmedPositionLetters[index] = normalizedLetter
        guessKnownCounts.set(normalizedLetter, (guessKnownCounts.get(normalizedLetter) ?? 0) + 1)
        return
      }

      if (letterResult.feedback === 'yellow') {
        guessKnownCounts.set(normalizedLetter, (guessKnownCounts.get(normalizedLetter) ?? 0) + 1)

        const chipKey = `${index}:${normalizedLetter}`

        if (!misplacedChipEntries.has(chipKey)) {
          misplacedChipEntries.set(chipKey, {
            letter: normalizedLetter,
            position: index,
            firstSeenGuessIndex: guessIndex,
          })
        }
      }
    })

    for (const [letter, count] of guessKnownCounts.entries()) {
      knownLetterCounts.set(letter, Math.max(knownLetterCounts.get(letter) ?? 0, count))
    }
  })

  const resolvedLetterCounts = new Map<string, number>()

  confirmedPositionLetters.forEach((letter) => {
    if (!letter) {
      return
    }

    resolvedLetterCounts.set(letter, (resolvedLetterCounts.get(letter) ?? 0) + 1)
  })

  const chipEntriesByLetter = new Map<string, Array<{ letter: string; position: number; firstSeenGuessIndex: number }>>()

  for (const chipEntry of misplacedChipEntries.values()) {
    const currentEntries = chipEntriesByLetter.get(chipEntry.letter) ?? []
    currentEntries.push(chipEntry)
    chipEntriesByLetter.set(chipEntry.letter, currentEntries)
  }

  const misplacedLettersByPosition = Array.from({ length: wordLength }, () => [] as string[])

  for (const [letter, chipEntries] of chipEntriesByLetter.entries()) {
    chipEntries.sort((left, right) => left.firstSeenGuessIndex - right.firstSeenGuessIndex || left.position - right.position)

    const knownCount = knownLetterCounts.get(letter) ?? 0
    const resolvedCount = resolvedLetterCounts.get(letter) ?? 0

    if (resolvedCount >= knownCount) {
      continue
    }

    const remainingChipEntries = knownCount <= 1
      ? chipEntries
      : chipEntries.slice(0, Math.max(chipEntries.length - resolvedCount, 0))

    for (const chipEntry of remainingChipEntries) {
      misplacedLettersByPosition[chipEntry.position].push(chipEntry.letter)
    }
  }

  return {
    confirmedPositionLetters,
    misplacedLettersByPosition,
  }
}

function getPlacementIcon(position: number): string {
  if (position === 1) {
    return '🥇'
  }

  if (position === 2) {
    return '🥈'
  }

  if (position === 3) {
    return '🥉'
  }

  return '🎯'
}

function getScoreboardCardClasses(position: number): string {
  if (position === 1) {
    return 'border-yellow-300/35 bg-yellow-400/14'
  }

  if (position === 2) {
    return 'border-slate-200/25 bg-slate-200/12'
  }

  if (position === 3) {
    return 'border-amber-500/30 bg-amber-600/14'
  }

  return 'border-white/8 bg-slate-950/55'
}

export function RoomPage() {
  const navigate = useNavigate()
  const { code = '' } = useParams()
  const {
    room,
    currentPlayerId,
    closedRoomCode,
    updateRoomSettings,
    startMatch,
    continueRound,
    rematch,
    submitGuess,
    sendChatMessage,
    leaveRoom,
    closeRoom,
    clearClosedRoomCode,
  } = useRoomSession()
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isStartingMatch, setIsStartingMatch] = useState(false)
  const [isContinuingRound, setIsContinuingRound] = useState(false)
  const [isRequestingRematch, setIsRequestingRematch] = useState(false)
  const [isSubmittingGuess, setIsSubmittingGuess] = useState(false)
  const [chatDraft, setChatDraft] = useState('')
  const [isSendingChat, setIsSendingChat] = useState(false)
  const [isLeavingRoom, setIsLeavingRoom] = useState(false)
  const [isClosingRoom, setIsClosingRoom] = useState(false)
  const [clockNow, setClockNow] = useState(() => Date.now())
  const normalizedCode = code.toUpperCase()

  const lobbyRoom = useMemo(() => {
    if (!room || room.roomCode !== normalizedCode || room.viewState !== 'lobby') {
      return null
    }

    return room as LobbyRoomSnapshot
  }, [normalizedCode, room])

  const activeRoom = useMemo(() => {
    if (!room || room.roomCode !== normalizedCode || room.viewState !== 'round_active') {
      return null
    }

    return room as ActiveRoundRoomSnapshot
  }, [normalizedCode, room])

  const summaryRoom = useMemo(() => {
    if (!room || room.roomCode !== normalizedCode || room.viewState !== 'round_summary') {
      return null
    }

    return room as RoundSummaryRoomSnapshot
  }, [normalizedCode, room])

  const finalResultsRoom = useMemo(() => {
    if (!room || room.roomCode !== normalizedCode || room.viewState !== 'final_results') {
      return null
    }

    return room as FinalResultsRoomSnapshot
  }, [normalizedCode, room])

  const [settingsForm, setSettingsForm] = useState<LobbySettingsFormState | null>(
    lobbyRoom ? toSettingsFormState(lobbyRoom.settings) : null,
  )

  useEffect(() => {
    if (lobbyRoom) {
      setSettingsForm(toSettingsFormState(lobbyRoom.settings))
    }
  }, [lobbyRoom])

  useEffect(() => {
    if (closedRoomCode === normalizedCode) {
      clearClosedRoomCode()
      navigate('/', { replace: true })
    }
  }, [clearClosedRoomCode, closedRoomCode, navigate, normalizedCode])

  const currentVisibleRoom = lobbyRoom ?? activeRoom ?? summaryRoom ?? finalResultsRoom
  const currentRoomCode = currentVisibleRoom?.roomCode ?? null
  const currentChatMessages = currentVisibleRoom?.chatMessages ?? []
  const currentRoomPlayer = currentVisibleRoom?.players.find((player) => player.playerId === currentPlayerId) ?? null
  const isHost = currentRoomPlayer?.isHost ?? false
  const isDesktopChat = useMediaQuery('(min-width: 1024px)')
  const isMobileLetterKeyboard = useMediaQuery('(max-width: 767px)')
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false)
  const unreadChatCount = useChatNotifications({
    roomCode: currentRoomCode,
    messages: currentChatMessages,
    currentPlayerId,
    reviewed: isDesktopChat || isMobileChatOpen,
  })

  const pvpRound = activeRoom?.round.mode === 'pvp' ? activeRoom.round : null
  const coopRound = activeRoom?.round.mode === 'coop' ? activeRoom.round : null
  const activeRoundPlayer = pvpRound?.players.find((player) => player.playerId === currentPlayerId) ?? null
  const currentPvpScoreEntry = pvpRound?.scoreboard.find((entry) => entry.playerId === currentPlayerId) ?? null
  const currentPvpRank = currentPvpScoreEntry && pvpRound
    ? pvpRound.scoreboard.findIndex((entry) => entry.playerId === currentPvpScoreEntry.playerId) + 1
    : null
  const activeWordLength = pvpRound?.wordLength ?? coopRound?.wordLength ?? 0
  const activeRoundKey = activeRoom ? `${activeRoom.roomCode}:${activeRoom.currentRoundNumber}:${activeRoom.round.mode}:${activeWordLength}` : null
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const [letters, setLetters] = useState<string[]>(() => createEmptyLetters(activeWordLength))
  const [activeInputIndex, setActiveInputIndex] = useState(0)

  useEffect(() => {
    if (!activeWordLength) {
      setLetters([])
      return
    }

    setLetters((currentLetters) => {
      if (currentLetters.length === activeWordLength) {
        return currentLetters
      }

      return createEmptyLetters(activeWordLength)
    })
  }, [activeWordLength])

  useEffect(() => {
    if ((!pvpRound?.timer.enabled || !pvpRound.timer.endsAt) && !summaryRoom) {
      return
    }

    const interval = window.setInterval(() => {
      setClockNow(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [pvpRound, summaryRoom])

  useEffect(() => {
    if (!activeRoundKey || !activeWordLength) {
      return
    }

    setLetters(createEmptyLetters(activeWordLength))
    setActiveInputIndex(0)
    setIsSubmittingGuess(false)
    requestAnimationFrame(() => inputRefs.current[0]?.focus())
  }, [activeRoundKey, activeWordLength])

  useEffect(() => {
    if (!isDesktopChat) {
      return
    }

    setIsMobileChatOpen(false)
  }, [isDesktopChat])

  useEffect(() => {
    setIsMobileChatOpen(false)
  }, [currentRoomCode])

  const activeTimerLabel = useMemo(() => {
    if (!pvpRound?.timer.enabled || !pvpRound.timer.endsAt) {
      return 'Sin temporizador'
    }

    const remainingSeconds = Math.max(
      Math.ceil((new Date(pvpRound.timer.endsAt).getTime() - clockNow) / 1000),
      0,
    )

    return formatRemainingSeconds(remainingSeconds)
  }, [clockNow, pvpRound])

  const canSubmitGuess = pvpRound
    ? Boolean(activeRoundPlayer && !activeRoundPlayer.solved && !activeRoundPlayer.outOfAttempts)
    : Boolean(coopRound && coopRound.status === 'active')
  const activeGuessHistory = pvpRound ? (activeRoundPlayer?.guessHistory ?? []) : (coopRound?.guessHistory ?? [])
  const isAutoSend = (pvpRound?.submissionMode ?? coopRound?.submissionMode) === 'auto_send'
  const isRowComplete = letters.length > 0 && letters.every((letter) => letter.length === 1)
  const boardIsSolved = pvpRound ? Boolean(activeRoundPlayer?.solved) : coopRound?.status === 'won'
  const boardOutOfAttempts = pvpRound ? Boolean(activeRoundPlayer?.outOfAttempts) : coopRound?.status === 'lost'
  const boardMessage = buildBoardMessage(Boolean(isAutoSend), canSubmitGuess, boardIsSolved, boardOutOfAttempts)
  const boardMessageIcon = getBoardMessageIcon(Boolean(isAutoSend), canSubmitGuess, boardIsSolved, boardOutOfAttempts)
  const boardMessageTone = getBoardMessageTone(canSubmitGuess, boardIsSolved, boardOutOfAttempts)
  const mobileKeyboardFeedback = useMemo(
    () => getKeyboardLetterFeedbackState(activeGuessHistory),
    [activeGuessHistory],
  )
  const boardClueState = useMemo(
    () => getBoardClueState(activeGuessHistory, activeWordLength),
    [activeGuessHistory, activeWordLength],
  )
  const hasMisplacedClues = boardClueState.misplacedLettersByPosition.some((lettersByPosition) => lettersByPosition.length > 0)
  const responsiveLetterBoxClassName = getResponsiveLetterBoxClassName(activeWordLength)

  useEffect(() => {
    if (!isAutoSend || !isRowComplete || !canSubmitGuess || isSubmittingGuess || !activeRoom) {
      return
    }

    void handleSubmitGuess(true)
  }, [activeRoom, canSubmitGuess, isAutoSend, isRowComplete, isSubmittingGuess])

  const handleCopyRoomCode = async () => {
    if (!currentRoomCode) {
      return
    }

    const roomCode = currentRoomCode

    try {
      await navigator.clipboard.writeText(roomCode)
      setCopyFeedback('Código copiado')
    } catch {
      setCopyFeedback('No se pudo copiar el código')
    }

    window.setTimeout(() => setCopyFeedback(null), 2000)
  }

  const handleSettingsChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target

    setSettingsForm((currentForm) => {
      if (!currentForm) {
        return currentForm
      }

      const nextForm = {
        ...currentForm,
        [name]: value,
      }

      if (name === 'mode' && value === 'coop') {
        nextForm.pvpTimerSeconds = ''
      }

      return nextForm
    })
  }

  const handleSaveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!lobbyRoom || !settingsForm) {
      return
    }

    setSettingsError(null)
    setActionMessage(null)
    setIsSavingSettings(true)

    try {
      await updateRoomSettings({
        roomCode: lobbyRoom.roomCode,
        settings: buildRoomSettings(settingsForm, lobbyRoom),
      })
      setActionMessage('Configuración sincronizada con todos los jugadores del lobby.')
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'No se pudo guardar la configuración.')
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleStartMatch = async () => {
    if (!lobbyRoom) {
      return
    }

    setActionMessage(null)
    setSettingsError(null)
    setIsStartingMatch(true)

    try {
      await startMatch({ roomCode: lobbyRoom.roomCode })
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'No se pudo iniciar la partida.')
    } finally {
      setIsStartingMatch(false)
    }
  }

  const handleContinueRound = async () => {
    if (!summaryRoom) {
      return
    }

    setActionMessage(null)
    setIsContinuingRound(true)

    try {
      await continueRound({ roomCode: summaryRoom.roomCode })
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'No se pudo continuar hacia la siguiente ronda.')
    } finally {
      setIsContinuingRound(false)
    }
  }

  const handleRematch = async () => {
    if (!finalResultsRoom) {
      return
    }

    setActionMessage(null)
    setIsRequestingRematch(true)

    try {
      await rematch({ roomCode: finalResultsRoom.roomCode })
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'No se pudo preparar la revancha.')
    } finally {
      setIsRequestingRematch(false)
    }
  }

  async function handleSubmitGuess(triggeredAutomatically = false) {
    if (!activeRoom || !canSubmitGuess || !isRowComplete || isSubmittingGuess) {
      return
    }

    setActionMessage(null)
    setIsSubmittingGuess(true)

    try {
      await submitGuess({
        roomCode: activeRoom.roomCode,
        guess: letters.join(''),
      })

      setLetters(createEmptyLetters(activeWordLength))
      setActiveInputIndex(0)
      setIsSubmittingGuess(false)
      requestAnimationFrame(() => inputRefs.current[0]?.focus())

      if (!triggeredAutomatically) {
        setActionMessage('Intento enviado.')
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'No se pudo enviar el intento.')
      setIsSubmittingGuess(false)
    }
  }

  const handleSendChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!currentVisibleRoom || !chatDraft.trim() || isSendingChat) {
      return
    }

    setIsSendingChat(true)

    try {
      await sendChatMessage({
        roomCode: currentVisibleRoom.roomCode,
        text: chatDraft,
      })
      setChatDraft('')
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'No se pudo enviar el mensaje.')
    } finally {
      setIsSendingChat(false)
    }
  }

  const handleLeaveRoom = async () => {
    if (!currentRoomCode) {
      return
    }

    const roomCode = currentRoomCode

    setActionMessage(null)
    setSettingsError(null)
    setIsLeavingRoom(true)

    try {
      await leaveRoom({ roomCode })
      navigate('/')
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'No se pudo salir de la sala.')
      setIsLeavingRoom(false)
    }
  }

  const handleCloseRoom = async () => {
    if (!currentRoomCode) {
      return
    }

    const roomCode = currentRoomCode

    setActionMessage(null)
    setSettingsError(null)
    setIsClosingRoom(true)

    try {
      await closeRoom({ roomCode })
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'No se pudo cerrar la sala.')
      setIsClosingRoom(false)
    }
  }

  const focusInput = (index: number) => {
    const safeIndex = Math.max(0, Math.min(index, Math.max(activeWordLength - 1, 0)))
    setActiveInputIndex(safeIndex)
    const input = inputRefs.current[safeIndex]
    input?.focus()
    input?.select()
  }

  const updateLetterAt = (index: number, rawValue: string) => {
    if (!canSubmitGuess || !activeWordLength) {
      return
    }

    setActiveInputIndex(index)
    const nextLetter = sanitizeLetter(rawValue)

    setLetters((currentLetters) => {
      const nextLetters = [...currentLetters]
      nextLetters[index] = nextLetter
      return nextLetters
    })

    if (nextLetter && index < activeWordLength - 1) {
      requestAnimationFrame(() => focusInput(index + 1))
      return
    }

    setActiveInputIndex(index)
  }

  const handleBoardKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    setActiveInputIndex(index)

    if (!activeWordLength) {
      return
    }

    if (event.key === 'Backspace' && !letters[index] && index > 0) {
      requestAnimationFrame(() => focusInput(index - 1))
      return
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      focusInput(index - 1)
      return
    }

    if (event.key === 'ArrowRight' && index < activeWordLength - 1) {
      event.preventDefault()
      focusInput(index + 1)
      return
    }

    if (event.key === 'Enter' && !isAutoSend) {
      event.preventDefault()
      void handleSubmitGuess(false)
    }
  }

  const handleMobileLetterPress = (letter: string) => {
    if (!canSubmitGuess || !activeWordLength) {
      return
    }

    const targetIndex = Math.min(activeInputIndex, Math.max(activeWordLength - 1, 0))
    updateLetterAt(targetIndex, letter)
  }

  const handleMobileBackspace = () => {
    if (!canSubmitGuess || !activeWordLength) {
      return
    }

    const targetIndex = Math.min(activeInputIndex, Math.max(activeWordLength - 1, 0))

    if (letters[targetIndex]) {
      updateLetterAt(targetIndex, '')
      focusInput(targetIndex)
      return
    }

    if (targetIndex > 0) {
      updateLetterAt(targetIndex - 1, '')
      focusInput(targetIndex - 1)
    }
  }

  const renderGuessRow = (guess: string, lettersResult: LetterResult[]) => {
    const rowLetterBoxClassName = getResponsiveLetterBoxClassName(lettersResult.length)

    return (
      <GuessGridRow key={`${guess}-${lettersResult.map((entry) => entry.feedback).join('-')}`} wordLength={lettersResult.length}>
        {lettersResult.map((letter, index) => (
          <LetterBox
            key={`${guess}-${index}`}
            value={letter.letter}
            feedback={letter.feedback}
            disabled
            className={rowLetterBoxClassName}
          />
        ))}
      </GuessGridRow>
    )
  }

  const boardComposer = (
    <div className="space-y-4 rounded-[26px] border border-[#7b7ddf] bg-[#5a5db1] px-4 py-4 shadow-[0_12px_24px_rgba(46,33,112,0.2)] sm:px-5 sm:py-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#dbe9ff]">Pistas visibles</p>
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#dbe9ff]/72">
            {hasMisplacedClues ? 'amarillas sobre esa casilla' : 'sin amarillas aún'}
          </span>
        </div>

        <GuessGridRow wordLength={activeWordLength} featured>
          {boardClueState.confirmedPositionLetters.map((letter, index) => (
            <div key={`clue-${index}`} className="flex min-w-0 flex-col justify-end gap-1.5">
              <div className="flex min-h-[1.6rem] flex-wrap content-end justify-center gap-1.5">
                {boardClueState.misplacedLettersByPosition[index].map((misplacedLetter) => (
                  <span
                    key={`misplaced-${index}-${misplacedLetter}`}
                    className="rounded-full border border-[#bf6233] bg-[#d8723f] px-2 py-0.5 text-[11px] font-black uppercase leading-none tracking-[0.12em] text-[#2f2378]"
                  >
                    {misplacedLetter}
                  </span>
                ))}
              </div>
              <LetterBox
                value={letter}
                feedback={letter ? 'green' : undefined}
                disabled
                className={`${responsiveLetterBoxClassName} ${letter ? '' : 'opacity-75'}`}
              />
            </div>
          ))}
        </GuessGridRow>
      </div>

      {canSubmitGuess ? (
        <div className="border-t border-white/12 pt-4">
          <p className="mb-3 text-center text-xs font-black uppercase tracking-[0.2em] text-[#fef3c7]">Tu intento actual</p>
          <GuessGridRow wordLength={activeWordLength} featured>
            {letters.map((letter, index) => (
              <LetterBox
                key={`active-${index}`}
                value={letter}
                autoFocus={index === 0 && activeGuessHistory.length === 0}
                ref={(element) => {
                  inputRefs.current[index] = element
                }}
                readOnly={isMobileLetterKeyboard}
                inputMode={isMobileLetterKeyboard ? 'none' : 'text'}
                onFocus={() => setActiveInputIndex(index)}
                onClick={() => setActiveInputIndex(index)}
                onChange={(value) => updateLetterAt(index, value)}
                onKeyDown={(event) => handleBoardKeyDown(index, event)}
                className={`${responsiveLetterBoxClassName} ${isMobileLetterKeyboard && activeInputIndex === index ? 'ring-4 ring-[#8ec7ff]/35' : ''}`}
              />
            ))}
          </GuessGridRow>
        </div>
      ) : null}
    </div>
  )

  if (activeRoom && pvpRound) {
    return (
      <div className="space-y-5 pb-20 lg:pb-0">
        <section className="rounded-[32px] border border-white/10 bg-slate-900/88 p-3 shadow-glow sm:p-6">
          <WordBoard
            timerLabel={pvpRound.timer.enabled ? activeTimerLabel : null}
            footer={isMobileLetterKeyboard || !isAutoSend ? (
              <>
                {isMobileLetterKeyboard && canSubmitGuess ? (
                  <div className="mb-4">
                    <MobileLetterKeyboard
                      disabledLetters={mobileKeyboardFeedback.disabledLetters}
                      letterStates={mobileKeyboardFeedback.letterStates}
                      onLetterPress={handleMobileLetterPress}
                      onBackspace={handleMobileBackspace}
                    />
                  </div>
                ) : null}

                {!isAutoSend ? (
                  <button
                    type="button"
                    onClick={() => void handleSubmitGuess(false)}
                    disabled={!canSubmitGuess || !isRowComplete || isSubmittingGuess}
                    className="mx-auto block w-full max-w-sm rounded-full bg-brand-500 px-5 py-4 text-lg font-black text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  >
                    {isSubmittingGuess ? 'Enviando...' : '🚀 Enviar palabra'}
                  </button>
                ) : null}
              </>
            ) : null}
          >
            {boardComposer}
          </WordBoard>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <GameStatCard icon="🎯" label="Intentos" value={String(activeRoundPlayer?.attemptsLeft ?? 0)} helper="restantes" tone="amber" />
            <GameStatCard
              icon="⏱️"
              label="Tiempo"
              value={pvpRound.timer.enabled ? activeTimerLabel : '∞'}
              helper={pvpRound.timer.enabled ? 'para esta palabra' : 'sin límite'}
              tone="blue"
            />
            <GameStatCard icon="🏁" label="Ronda" value={`${activeRoom.currentRoundNumber}/${activeRoom.totalRounds}`} helper="progreso" tone="violet" />
            <GameStatCard
              icon="🏆"
              label="Puntos"
              value={String(currentPvpScoreEntry?.totalPoints ?? 0)}
              helper={currentPvpRank ? `puesto #${currentPvpRank}` : 'en carrera'}
              tone="emerald"
            />
          </div>

          <div className="mt-4">
            <GameStatusBanner icon={boardMessageIcon} title="Tu misión" message={boardMessage} tone={boardMessageTone} />
          </div>
        </section>

        <RoomStageHeader
          badge={`PVP · Sala ${activeRoom.roomCode}`}
          title={`Ronda ${activeRoom.currentRoundNumber} de ${activeRoom.totalRounds}`}
          subtitle={`Juegas como ${currentRoomPlayer?.nickname ?? 'jugador'}${currentPvpRank ? ` · puesto #${currentPvpRank}` : ''}.`}
          actions={(
            <>
              {isHost ? (
                <RoomIconButton label="Cerrar sala" icon={closeIcon} tone="warning" onClick={() => void handleCloseRoom()} disabled={isClosingRoom} />
              ) : null}
              <RoomIconButton label="Salir de la sala" icon={exitIcon} tone="danger" onClick={() => void handleLeaveRoom()} disabled={isLeavingRoom} />
            </>
          )}
        />

        {actionMessage ? <div className="rounded-[26px] border border-emerald-500/30 bg-emerald-500/12 px-4 py-3 text-base text-emerald-100">{actionMessage}</div> : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <RoomPanel title="🎮 Panel de juego" description="Todo lo necesario sin llenar la pantalla de texto.">
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                <GameStatCard icon="🔤" label="Letras" value={String(pvpRound.wordLength)} helper="en la palabra" tone="violet" />
                <GameStatCard icon="⚡" label="Envío" value={isAutoSend ? 'Auto' : 'Manual'} helper={isAutoSend ? 'al completar fila' : 'usa el botón'} tone="blue" />
                <GameStatCard icon="🏟️" label="Sala" value={activeRoom.roomCode} helper={`${activeRoom.players.length} jugando`} tone="amber" />
                <GameStatCard
                  icon="🎖️"
                  label="Posición"
                  value={String(activeRoundPlayer?.finishPlacement ?? currentPvpScoreEntry?.currentPlacement ?? currentPvpRank ?? '-')}
                  helper={activeRoundPlayer?.solved ? 'ya llegaste' : 'sigues en carrera'}
                  tone="emerald"
                />
              </div>
            </RoomPanel>
          </div>

          <div className="space-y-5">
            <div className="hidden lg:block">
              <RoomPanel title="🏆 Marcador" description="Ranking rápido para ver quién va ganando.">
                <div className="space-y-3 text-slate-300">
                  {pvpRound.scoreboard.map((scoreEntry, index) => {
                    const player = pvpRound.players.find((candidate) => candidate.playerId === scoreEntry.playerId)

                    return (
                      <div key={scoreEntry.playerId} className={`rounded-[26px] border px-4 py-4 ${getScoreboardCardClasses(index + 1)}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-2xl">
                            {getPlacementIcon(index + 1)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-lg font-black text-white">{scoreEntry.nickname}</p>
                              {scoreEntry.playerId === currentPlayerId ? <span className="rounded-full border border-emerald-300/30 bg-emerald-500/12 px-2 py-0.5 text-[11px] font-black text-emerald-100">TÚ</span> : null}
                            </div>
                            <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-slate-300/70">
                              {scoreEntry.currentPlacement === null ? 'Aún jugando' : `Llegó puesto ${scoreEntry.currentPlacement}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-white">{scoreEntry.totalPoints}</p>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300/70">pts</p>
                          </div>
                        </div>
                        {player?.solved ? <p className="mt-3 text-sm font-semibold text-emerald-200">✅ Ya resolvió la palabra.</p> : null}
                        {player?.outOfAttempts ? <p className="mt-3 text-sm font-semibold text-rose-200">❌ Se quedó sin filas.</p> : null}
                      </div>
                    )
                  })}
                </div>
              </RoomPanel>
            </div>

            <RoomChatDock
              title="💬 Chat PVP"
              messages={currentChatMessages}
              draft={chatDraft}
              onDraftChange={setChatDraft}
              onSend={handleSendChat}
              isSending={isSendingChat}
              mobileOpen={isMobileChatOpen}
              onMobileOpenChange={setIsMobileChatOpen}
              unreadCount={unreadChatCount}
            />
          </div>
        </div>
      </div>
    )
  }

  if (activeRoom && coopRound) {
    return (
      <div className="space-y-5 pb-20 lg:pb-0">
        <section className="rounded-[32px] border border-white/10 bg-slate-900/88 p-3 shadow-glow sm:p-6">
          <WordBoard
            footer={isMobileLetterKeyboard || !isAutoSend ? (
              <>
                {isMobileLetterKeyboard && canSubmitGuess ? (
                  <div className="mb-4">
                    <MobileLetterKeyboard
                      disabledLetters={mobileKeyboardFeedback.disabledLetters}
                      letterStates={mobileKeyboardFeedback.letterStates}
                      onLetterPress={handleMobileLetterPress}
                      onBackspace={handleMobileBackspace}
                    />
                  </div>
                ) : null}

                {!isAutoSend ? (
                  <button
                    type="button"
                    onClick={() => void handleSubmitGuess(false)}
                    disabled={!canSubmitGuess || !isRowComplete || isSubmittingGuess}
                    className="mx-auto block w-full max-w-sm rounded-full bg-brand-500 px-5 py-4 text-lg font-black text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  >
                    {isSubmittingGuess ? 'Enviando...' : '🚀 Enviar palabra'}
                  </button>
                ) : null}
              </>
            ) : null}
          >
            {boardComposer}
          </WordBoard>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <GameStatCard icon="🎯" label="Intentos" value={String(coopRound.attemptsLeft)} helper="del equipo" tone="amber" />
            <GameStatCard icon="🏁" label="Ronda" value={`${activeRoom.currentRoundNumber}/${activeRoom.totalRounds}`} helper="progreso" tone="violet" />
            <GameStatCard icon="✨" label="Aciertos" value={String(coopRound.roundsWon)} helper="rondas ganadas" tone="emerald" />
            <GameStatCard icon="🧑‍🤝‍🧑" label="Equipo" value={String(activeRoom.players.length)} helper="jugadores" tone="blue" />
          </div>

          <div className="mt-4">
            <GameStatusBanner icon={boardMessageIcon} title="Misión del equipo" message={boardMessage} tone={boardMessageTone} />
          </div>
        </section>

        <RoomStageHeader
          badge={`CO-OP · Sala ${activeRoom.roomCode}`}
          title={`Ronda ${activeRoom.currentRoundNumber} de ${activeRoom.totalRounds}`}
          subtitle={`Todos comparten el mismo tablero · ${coopRound.attemptsLeft} intentos del equipo.`}
          actions={(
            <>
              {isHost ? (
                <RoomIconButton label="Cerrar sala" icon={closeIcon} tone="warning" onClick={() => void handleCloseRoom()} disabled={isClosingRoom} />
              ) : null}
              <RoomIconButton label="Salir de la sala" icon={exitIcon} tone="danger" onClick={() => void handleLeaveRoom()} disabled={isLeavingRoom} />
            </>
          )}
        />

        {actionMessage ? <div className="rounded-[26px] border border-emerald-500/30 bg-emerald-500/12 px-4 py-3 text-base text-emerald-100">{actionMessage}</div> : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <RoomPanel title="🧑‍🤝‍🧑 Equipo" description="Jugadores listos para resolver la palabra juntos.">
              <div className="space-y-3 text-slate-300">
                {activeRoom.players.map((player) => (
                  <div key={player.playerId} className="flex items-center justify-between gap-3 rounded-[26px] border border-white/8 bg-slate-950/55 px-4 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-brand-300/25 bg-brand-400/14 text-lg font-black text-brand-100">
                        {getPlayerInitial(player.nickname)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-white">{player.nickname}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{formatConnectionState(player.connectionState)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 text-xs">
                      {player.isHost ? <span className="rounded-full border border-amber-300/30 bg-amber-500/12 px-3 py-1 font-black text-amber-100">👑 Host</span> : null}
                      {player.playerId === currentPlayerId ? <span className="rounded-full border border-emerald-300/30 bg-emerald-500/12 px-3 py-1 font-black text-emerald-100">⭐ Tú</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </RoomPanel>

            <RoomPanel title="📊 Estado rápido" description="Lectura simple para seguir la partida sin distraerse.">
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                <GameStatCard icon="🔤" label="Letras" value={String(coopRound.wordLength)} helper="en la palabra" tone="violet" />
                <GameStatCard icon="⚡" label="Envío" value={isAutoSend ? 'Auto' : 'Manual'} helper={isAutoSend ? 'al completar fila' : 'usa el botón'} tone="blue" />
                <GameStatCard icon="❤️" label="Fallos" value={String(coopRound.roundsLost)} helper="rondas perdidas" tone="rose" />
                <GameStatCard icon="🏟️" label="Sala" value={activeRoom.roomCode} helper="misma palabra para todos" tone="amber" />
              </div>
            </RoomPanel>
          </div>

          <div className="space-y-5">
            <RoomChatDock
              title="💬 Chat del equipo"
              messages={currentChatMessages}
              draft={chatDraft}
              onDraftChange={setChatDraft}
              onSend={handleSendChat}
              isSending={isSendingChat}
              mobileOpen={isMobileChatOpen}
              onMobileOpenChange={setIsMobileChatOpen}
              unreadCount={unreadChatCount}
            />
          </div>
        </div>
      </div>
    )
  }

  if (summaryRoom && summaryRoom.summary.mode === 'coop') {
    const summaryCountdownSeconds = Math.max(
      Math.ceil((new Date(summaryRoom.summaryAutoAdvanceAt).getTime() - clockNow) / 1000),
      0,
    )

    return (
      <div className="space-y-5">
        <RoomStageHeader
          badge={`Resumen cooperativo · Sala ${summaryRoom.roomCode}`}
          title={summaryRoom.summary.outcome === 'won' ? 'Palabra acertada' : 'Ronda perdida'}
          subtitle={`La palabra de esta ronda fue ${summaryRoom.summary.secretWord.toUpperCase()}.`}
          actions={(
            <>
              {isHost ? (
                <RoomIconButton label="Cerrar sala" icon={closeIcon} tone="warning" onClick={() => void handleCloseRoom()} disabled={isClosingRoom} />
              ) : null}
              <RoomIconButton label="Salir de la sala" icon={exitIcon} tone="danger" onClick={() => void handleLeaveRoom()} disabled={isLeavingRoom} />
            </>
          )}
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <RoomPanel title="Resumen de la ronda" description="Se conserva el historial compartido con el nombre de quien envió cada fila.">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-3 text-sm text-slate-300">
                <p className="font-semibold text-white">
                  {summaryRoom.summary.outcome === 'won' ? 'El equipo resolvió la palabra.' : 'El equipo agotó todas sus filas disponibles.'}
                </p>
                {summaryRoom.summary.solvedByNickname ? (
                  <p className="mt-2 text-slate-300">Último acierto: {summaryRoom.summary.solvedByNickname}</p>
                ) : null}
              </div>

              <div className="space-y-2.5">
                {summaryRoom.summary.guessHistory.map((guessRecord) => (
                  <div key={`${guessRecord.guess}-${guessRecord.submittedAt}`} className="space-y-1">
                    <p className="mx-auto max-w-[560px] text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {guessRecord.submittedByNickname ?? 'Jugador'}
                    </p>
                    {renderGuessRow(guessRecord.guess, guessRecord.result)}
                  </div>
                ))}
              </div>
            </div>
          </RoomPanel>

          <RoomPanel title="Progreso del equipo" description="Vista mínima del marcador cooperativo actual.">
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-3">
                <p>Rondas acertadas: <span className="font-semibold text-white">{summaryRoom.summary.roundsWon}</span></p>
                <p className="mt-2">Rondas perdidas: <span className="font-semibold text-white">{summaryRoom.summary.roundsLost}</span></p>
              </div>

              <div className="rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-3">
                {summaryRoom.canCurrentPlayerAdvanceSummary ? (
                  <p className="font-medium text-white">Autoavance en {formatRemainingSeconds(summaryCountdownSeconds)}</p>
                ) : (
                  <p className="font-medium text-white">Esperando a la persona anfitriona</p>
                )}
                <p className="mt-2 text-slate-400">
                  {summaryRoom.canCurrentPlayerAdvanceSummary
                    ? 'Puedes continuar ahora o dejar que el cronómetro avance solo.'
                    : 'La siguiente ronda comenzará cuando la persona anfitriona continúe.'}
                </p>
              </div>

              {summaryRoom.canCurrentPlayerAdvanceSummary ? (
                <button
                  type="button"
                  onClick={() => void handleContinueRound()}
                  disabled={isContinuingRound}
                  className="w-full rounded-full bg-brand-500 px-5 py-3.5 text-base font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {isContinuingRound
                    ? 'Continuando...'
                    : summaryRoom.currentRoundNumber >= summaryRoom.totalRounds
                      ? 'Ver resultado final'
                      : 'Continuar'}
                </button>
              ) : null}
            </div>
          </RoomPanel>
        </div>
      </div>
    )
  }

  if (summaryRoom && summaryRoom.summary.mode === 'pvp') {
    const summaryCountdownSeconds = Math.max(
      Math.ceil((new Date(summaryRoom.summaryAutoAdvanceAt).getTime() - clockNow) / 1000),
      0,
    )

    return (
      <div className="space-y-5">
        <RoomStageHeader
          badge={`Resumen PVP · Sala ${summaryRoom.roomCode}`}
          title="Ronda cerrada"
          subtitle={`La palabra de esta ronda fue ${summaryRoom.summary.secretWord.toUpperCase()}.`}
          actions={(
            <>
              {isHost ? (
                <RoomIconButton label="Cerrar sala" icon={closeIcon} tone="warning" onClick={() => void handleCloseRoom()} disabled={isClosingRoom} />
              ) : null}
              <RoomIconButton label="Salir de la sala" icon={exitIcon} tone="danger" onClick={() => void handleLeaveRoom()} disabled={isLeavingRoom} />
            </>
          )}
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <RoomPanel title="Resultado de la ronda" description="Aquí solo se muestra lo esencial antes de pasar a la siguiente palabra.">
            <div className="space-y-3 text-sm text-slate-300">
              {summaryRoom.summary.placements.map((placement, index) => (
                <div key={placement.playerId} className="rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">#{index + 1} · {placement.nickname}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {placement.placement === null ? 'No la resolvió a tiempo' : `Llegó en el puesto ${placement.placement}`}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">+{placement.roundPoints} puntos</span>
                  </div>
                </div>
              ))}
            </div>
          </RoomPanel>

          <RoomPanel title="Ranking actual" description="La clasificación ya incluye los puntos acumulados hasta esta ronda.">
            <div className="space-y-3 text-sm text-slate-300">
              {summaryRoom.summary.scoreboard.map((scoreEntry, index) => (
                <div key={scoreEntry.playerId} className="flex items-center justify-between rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-3">
                  <div>
                    <p className="font-semibold text-white">#{index + 1} · {scoreEntry.nickname}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {scoreEntry.currentPlacement === null ? 'Sin puesto en esta ronda' : `Puesto actual ${scoreEntry.currentPlacement}`}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">{scoreEntry.totalPoints} puntos</span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-3 text-sm text-slate-300">
              {summaryRoom.canCurrentPlayerAdvanceSummary ? (
                <p className="font-medium text-white">Autoavance en {formatRemainingSeconds(summaryCountdownSeconds)}</p>
              ) : (
                <p className="font-medium text-white">Esperando a la persona anfitriona</p>
              )}
              {summaryRoom.summary.timer.enabled ? (
                <p className="mt-2 text-slate-400">Tiempo final de la ronda: {formatRemainingSeconds(summaryRoom.summary.timer.remainingSeconds)}</p>
              ) : null}
            </div>

            {summaryRoom.canCurrentPlayerAdvanceSummary ? (
              <button
                type="button"
                onClick={() => void handleContinueRound()}
                disabled={isContinuingRound}
                className="mt-4 w-full rounded-full bg-brand-500 px-5 py-3.5 text-base font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isContinuingRound
                  ? 'Continuando...'
                  : summaryRoom.currentRoundNumber >= summaryRoom.totalRounds
                    ? 'Ver resultado final'
                    : 'Continuar'}
              </button>
            ) : null}
          </RoomPanel>
        </div>
      </div>
    )
  }

  if (finalResultsRoom) {
    const currentFinalRoomPlayer = finalResultsRoom.players.find((player) => player.playerId === currentPlayerId) ?? null
    const isFinalRoomHost = currentFinalRoomPlayer?.isHost ?? false

    return (
      <div className="space-y-5">
        <RoomStageHeader
          badge={`Resultados finales · Sala ${finalResultsRoom.roomCode}`}
          title={finalResultsRoom.finalResults.mode === 'pvp'
            ? (finalResultsRoom.finalResults.standings[0]?.nickname ?? 'Sin ganador')
            : buildCoopFinalMessage(finalResultsRoom.finalResults.roundsWon, finalResultsRoom.finalResults.roundsLost)}
          subtitle={finalResultsRoom.finalResults.mode === 'pvp'
            ? 'Ganador de la partida'
            : 'Resumen final del equipo'}
          actions={(
            <>
              {isFinalRoomHost ? (
                <RoomIconButton label="Cerrar sala" icon={closeIcon} tone="warning" onClick={() => void handleCloseRoom()} disabled={isClosingRoom} />
              ) : null}
              <RoomIconButton label="Salir de la sala" icon={exitIcon} tone="danger" onClick={() => void handleLeaveRoom()} disabled={isLeavingRoom} />
            </>
          )}
        />

        {actionMessage ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/12 px-4 py-3 text-sm text-emerald-100">{actionMessage}</div> : null}

        {finalResultsRoom.finalResults.mode === 'pvp' ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <RoomPanel title="Ganador" description="La clasificación final usa la puntuación acumulada de toda la partida.">
              <div className="rounded-[28px] border border-brand-300/30 bg-brand-400/14 px-5 py-6 text-center text-slate-100">
                <p className="text-xs uppercase tracking-[0.22em] text-brand-100">Primer lugar</p>
                <p className="mt-3 text-3xl font-bold text-white">{finalResultsRoom.finalResults.standings[0]?.nickname ?? 'Sin resultado'}</p>
                <p className="mt-3 text-base text-slate-200">{finalResultsRoom.finalResults.standings[0]?.totalPoints ?? 0} puntos</p>
              </div>

              {isFinalRoomHost ? (
                <button
                  type="button"
                  onClick={() => void handleRematch()}
                  disabled={isRequestingRematch}
                  className="mt-4 w-full rounded-full bg-brand-500 px-5 py-3.5 text-base font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {isRequestingRematch ? 'Preparando revancha...' : 'Jugar otra vez'}
                </button>
              ) : null}
            </RoomPanel>

            <RoomPanel title="Clasificación final" description="Tabla vertical con posiciones y puntuación final.">
              <div className="space-y-3 text-sm text-slate-300">
                {finalResultsRoom.finalResults.standings.map((standing) => (
                  <div key={standing.playerId} className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${finalPlacementClasses(standing.finalPlacement)}`}>
                    <div>
                      <p className="font-semibold">#{standing.finalPlacement} · {standing.nickname}</p>
                      <p className="text-xs uppercase tracking-[0.18em] opacity-80">Posición final</p>
                    </div>
                    <span className="rounded-full border border-current/20 px-3 py-1 text-xs font-semibold">{standing.totalPoints} puntos</span>
                  </div>
                ))}
              </div>
            </RoomPanel>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <RoomPanel title="Resultado del equipo" description="Aquí quedan registradas todas las palabras acertadas y las que faltaron.">
              <div className="space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-3">
                  Palabras acertadas: <span className="font-semibold text-white">{finalResultsRoom.finalResults.roundsWon}</span>
                </div>
                <div className="rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-3">
                  Palabras perdidas: <span className="font-semibold text-white">{finalResultsRoom.finalResults.rounds.filter((roundEntry) => roundEntry.outcome === 'lost').length}</span>
                </div>
                {isFinalRoomHost ? (
                  <button
                    type="button"
                    onClick={() => void handleRematch()}
                    disabled={isRequestingRematch}
                    className="w-full rounded-full bg-brand-500 px-5 py-3.5 text-base font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  >
                    {isRequestingRematch ? 'Preparando revancha...' : 'Jugar otra vez'}
                  </button>
                ) : null}
              </div>
            </RoomPanel>

            <RoomPanel title="Palabras del equipo" description="Las palabras acertadas conservan el nombre de quien completó la fila final.">
              <div className="space-y-4 text-sm text-slate-300">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Acertadas</p>
                  <div className="space-y-2">
                    {finalResultsRoom.finalResults.rounds.filter((roundEntry) => roundEntry.outcome === 'won').length > 0 ? (
                      finalResultsRoom.finalResults.rounds
                        .filter((roundEntry) => roundEntry.outcome === 'won')
                        .map((roundEntry) => (
                          <div key={`won-${roundEntry.roundNumber}`} className="rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-3">
                            <p className="font-semibold text-white">{roundEntry.secretWord.toUpperCase()}</p>
                            <p className="mt-1 text-slate-400">Resuelta por {roundEntry.solvedByNickname ?? 'el equipo'}</p>
                          </div>
                        ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/8 bg-slate-950/40 px-4 py-3 text-slate-400">
                        El equipo no acertó ninguna palabra en esta partida.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Perdidas</p>
                  <div className="space-y-2">
                    {finalResultsRoom.finalResults.rounds.filter((roundEntry) => roundEntry.outcome === 'lost').length > 0 ? (
                      finalResultsRoom.finalResults.rounds
                        .filter((roundEntry) => roundEntry.outcome === 'lost')
                        .map((roundEntry) => (
                          <div key={`lost-${roundEntry.roundNumber}`} className="rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-3">
                            <p className="font-semibold text-white">{roundEntry.secretWord.toUpperCase()}</p>
                          </div>
                        ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/8 bg-slate-950/40 px-4 py-3 text-slate-400">
                        No quedaron palabras pendientes.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </RoomPanel>
          </div>
        )}
      </div>
    )
  }

  if (!lobbyRoom) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/10 bg-slate-900/85 p-8 shadow-glow">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Sala no disponible</p>
          <h2 className="mt-2 text-3xl font-bold text-white">No hay una sesión activa para la sala {normalizedCode}.</h2>
          <p className="mt-3 max-w-2xl text-slate-300">
            Crea una sala o usa tu código para volver a entrar. Si ya tenías una sesión activa, intentaremos recuperarla al reconectar.
          </p>
        </section>

        <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
          <span>Vuelve al inicio para crear una sala nueva o entrar con otro código.</span>
          <Link className="rounded-full border border-white/10 px-4 py-2 transition hover:border-brand-400 hover:text-white" to="/">
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  return (
    <RoomLobbyView
      room={lobbyRoom}
      currentPlayerId={currentPlayerId}
      isHost={isHost}
      settingsForm={settingsForm}
      settingsError={settingsError}
      actionMessage={actionMessage}
      copyFeedback={copyFeedback}
      isSavingSettings={isSavingSettings}
      isStartingMatch={isStartingMatch}
      isSendingChat={isSendingChat}
      isLeavingRoom={isLeavingRoom}
      isClosingRoom={isClosingRoom}
      chatDraft={chatDraft}
      unreadCount={unreadChatCount}
      isMobileChatOpen={isMobileChatOpen}
      onSettingsChange={handleSettingsChange}
      onSaveSettings={handleSaveSettings}
      onStartMatch={() => void handleStartMatch()}
      onSendChat={handleSendChat}
      onChatDraftChange={setChatDraft}
      onChatOpenChange={setIsMobileChatOpen}
      onCopyRoomCode={() => void handleCopyRoomCode()}
      onLeaveRoom={() => void handleLeaveRoom()}
      onCloseRoom={() => void handleCloseRoom()}
    />
  )
}
