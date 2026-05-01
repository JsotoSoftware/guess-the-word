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
import { SectionCard } from '../components/ui/SectionCard'
import { useRoomSession } from '../contexts/room-session'

interface LobbySettingsFormState {
  mode: RoomSettings['mode']
  totalRounds: string
  attemptsPerRound: string
  pvpTimerSeconds: string
  submissionMode: GuessSubmissionMode
  maxPlayers: string
}

function formatSubmissionMode(value: GuessSubmissionMode): string {
  return value === 'auto_send' ? 'Autoenvío' : 'Envío manual'
}

function formatTimer(value: number | null): string {
  return value === null ? 'Sin temporizador' : `${value} segundos`
}

function formatMode(value: LobbyRoomSnapshot['settings']['mode']): string {
  return value === 'pvp' ? 'PVP' : 'Cooperativo'
}

function toSettingsFormState(settings: RoomSettings): LobbySettingsFormState {
  return {
    mode: settings.mode,
    totalRounds: String(settings.totalRounds),
    attemptsPerRound: String(settings.attemptsPerRound),
    pvpTimerSeconds: settings.pvpTimerSeconds === null ? '' : String(settings.pvpTimerSeconds),
    submissionMode: settings.submissionMode,
    maxPlayers: settings.maxPlayers === null ? '' : String(settings.maxPlayers),
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
    roundSummaryAutoAdvanceSeconds: room.settings.roundSummaryAutoAdvanceSeconds,
  }
}

function getStartMessage(room: LobbyRoomSnapshot, isHost: boolean): string {
  if (!isHost) {
    return 'Solo el anfitrión podrá iniciar la partida.'
  }

  const connectedPlayersCount = room.players.filter((player) => player.connectionState === 'connected').length

  if (room.settings.mode === 'pvp' && connectedPlayersCount < 2) {
    return 'PVP requiere al menos 2 jugadores conectados para habilitar el inicio.'
  }

  if (room.settings.mode === 'coop') {
    return 'La sala ya cumple las restricciones para iniciar la partida cooperativa.'
  }

  return 'La sala ya cumple las restricciones para iniciar la partida PVP.'
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

function formatConnectionState(value: 'connected' | 'disconnected' | 'reconnecting'): string {
  if (value === 'connected') {
    return 'Conectado'
  }

  if (value === 'reconnecting') {
    return 'Reconectando'
  }

  return 'Desconectado'
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
    return 'La ronda ya no acepta más guesses.'
  }

  return hasAutoSend
    ? 'Completa la fila y el guess se enviará automáticamente.'
    : 'Completa la fila y presiona el botón para enviar el guess.'
}

export function RoomPage() {
  const navigate = useNavigate()
  const { code = '' } = useParams()
  const {
    room,
    connected,
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
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const isHost = currentRoomPlayer?.isHost ?? false

  const pvpRound = activeRoom?.round.mode === 'pvp' ? activeRoom.round : null
  const coopRound = activeRoom?.round.mode === 'coop' ? activeRoom.round : null
  const activeRoundPlayer = pvpRound?.players.find((player) => player.playerId === currentPlayerId) ?? null
  const activeWordLength = pvpRound?.wordLength ?? coopRound?.wordLength ?? 0
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const [letters, setLetters] = useState<string[]>(() => createEmptyLetters(activeWordLength))

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
    if (pvpRound && activeRoundPlayer) {
      setLetters(createEmptyLetters(pvpRound.wordLength))
      setIsSubmittingGuess(false)
      requestAnimationFrame(() => inputRefs.current[0]?.focus())
      return
    }

    if (coopRound) {
      setLetters(createEmptyLetters(coopRound.wordLength))
      setIsSubmittingGuess(false)
      requestAnimationFrame(() => inputRefs.current[0]?.focus())
    }
  }, [
    activeRoundPlayer?.guessHistory.length,
    activeRoundPlayer?.attemptsLeft,
    activeRoundPlayer?.solved,
    activeRoundPlayer?.outOfAttempts,
    coopRound?.guessHistory.length,
    coopRound?.attemptsLeft,
    coopRound?.status,
    pvpRound,
    coopRound,
  ])

  useEffect(() => {
    const chatContainer = chatScrollRef.current

    if (!chatContainer) {
      return
    }

    chatContainer.scrollTop = chatContainer.scrollHeight
  }, [currentVisibleRoom?.roomCode, currentChatMessages.length])

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
  const isAutoSend = (pvpRound?.submissionMode ?? coopRound?.submissionMode) === 'auto_send'
  const isRowComplete = letters.length > 0 && letters.every((letter) => letter.length === 1)
  const boardMessage = buildBoardMessage(
    Boolean(isAutoSend),
    canSubmitGuess,
    pvpRound ? Boolean(activeRoundPlayer?.solved) : coopRound?.status === 'won',
    pvpRound ? Boolean(activeRoundPlayer?.outOfAttempts) : coopRound?.status === 'lost',
  )

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

      if (!triggeredAutomatically) {
        setActionMessage('Guess enviado correctamente.')
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'No se pudo enviar el guess.')
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

  const renderChatPanel = (title: string, description: string) => (
    <SectionCard title={title} description={description}>
      <div className="space-y-3 text-sm text-slate-300">
        <div
          ref={chatScrollRef}
          className="h-80 overflow-y-auto rounded-2xl border border-white/5 bg-slate-950/60 p-4 text-slate-400"
        >
          {currentChatMessages.length > 0 ? (
            currentChatMessages.map((message) => (
              <div key={message.messageId} className="mb-3 rounded-2xl border border-white/5 bg-slate-900/70 px-3 py-2 last:mb-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{message.senderNickname}</p>
                  <p className="text-xs text-slate-500">{new Date(message.sentAt).toLocaleTimeString()}</p>
                </div>
                <p className="mt-1">{message.text}</p>
              </div>
            ))
          ) : (
            <p>Aún no hay mensajes en esta sala.</p>
          )}
        </div>

        <form className="flex gap-3" onSubmit={handleSendChat}>
          <input
            type="text"
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            placeholder="Escribe un mensaje para la sala"
            maxLength={300}
            className="flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-brand-400"
          />
          <button
            type="submit"
            disabled={isSendingChat || !chatDraft.trim()}
            className="rounded-full bg-brand-500 px-5 py-3 font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {isSendingChat ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </div>
    </SectionCard>
  )

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
    const input = inputRefs.current[index]
    input?.focus()
    input?.select()
  }

  const updateLetterAt = (index: number, rawValue: string) => {
    if (!canSubmitGuess || !activeWordLength) {
      return
    }

    const nextLetter = sanitizeLetter(rawValue)

    setLetters((currentLetters) => {
      const nextLetters = [...currentLetters]
      nextLetters[index] = nextLetter
      return nextLetters
    })

    if (nextLetter && index < activeWordLength - 1) {
      requestAnimationFrame(() => focusInput(index + 1))
    }
  }

  const handleBoardKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
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

  const renderGuessRow = (guess: string, lettersResult: LetterResult[]) => (
    <div key={`${guess}-${lettersResult.map((entry) => entry.feedback).join('-')}`} className="flex flex-wrap gap-2.5">
      {lettersResult.map((letter, index) => (
        <LetterBox key={`${guess}-${index}`} value={letter.letter} feedback={letter.feedback} disabled />
      ))}
    </div>
  )

  if (activeRoom && pvpRound) {
    return (
      <div className="space-y-8">
        <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/85 p-8 shadow-glow lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Partida PVP activa · fase 6.3</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Sala {activeRoom.roomCode}</h2>
            <p className="mt-3 max-w-2xl text-slate-300">
              Ronda {activeRoom.currentRoundNumber} de {activeRoom.totalRounds}. Conectado como {currentRoomPlayer?.nickname ?? 'jugador'}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCopyRoomCode}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-brand-400 hover:text-white"
            >
              Copiar código
            </button>
            {isHost ? (
              <button
                type="button"
                onClick={handleCloseRoom}
                disabled={isClosingRoom}
                className="rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 transition hover:border-amber-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isClosingRoom ? 'Cerrando sala...' : 'Cerrar sala'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleLeaveRoom}
              disabled={isLeavingRoom}
              className="rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100 transition hover:border-rose-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLeavingRoom ? 'Saliendo...' : 'Salir de la sala'}
            </button>
            <span className={`rounded-full border px-4 py-2 text-sm ${connected ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
              {connected ? 'Conectado' : 'Reconectando'}
            </span>
          </div>
        </section>

        {copyFeedback ? <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">{copyFeedback}</div> : null}
        {actionMessage ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{actionMessage}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
          <SectionCard title="Tu tablero" description="Cada jugador avanza de forma independiente dentro de la misma ronda PVP.">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2">Letras: {pvpRound.wordLength}</span>
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2">Tus intentos: {activeRoundPlayer?.attemptsLeft ?? activeRoom.settings.attemptsPerRound}</span>
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2">Envío: {formatSubmissionMode(pvpRound.submissionMode)}</span>
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2">Temporizador: {activeTimerLabel}</span>
              </div>

              <div className="rounded-[28px] border-[5px] border-[#4659ba] bg-gradient-to-b from-[#7cb3ff] via-[#66a7ff] to-[#4d87ef] p-4 shadow-[0_18px_40px_rgba(30,64,175,0.35)]">
                <div className="rounded-[22px] border-[4px] border-[#3048a8] bg-[#88b7ff] p-3 shadow-[inset_0_-6px_0_rgba(28,64,150,0.35)]">
                  <div className="space-y-2.5">
                    {activeRoundPlayer?.guessHistory.map((guessRecord) => renderGuessRow(guessRecord.guess, guessRecord.result))}

                    {canSubmitGuess ? (
                      <div className="flex flex-wrap gap-2.5">
                        {letters.map((letter, index) => (
                          <LetterBox
                            key={`active-${index}`}
                            value={letter}
                            autoFocus={index === 0 && (activeRoundPlayer?.guessHistory.length ?? 0) === 0}
                            ref={(element) => {
                              inputRefs.current[index] = element
                            }}
                            onChange={(value) => updateLetterAt(index, value)}
                            onKeyDown={(event) => handleBoardKeyDown(index, event)}
                          />
                        ))}
                      </div>
                    ) : null}

                    {Array.from({
                      length: Math.max(
                        activeRoom.settings.attemptsPerRound - (activeRoundPlayer?.guessHistory.length ?? 0) - (canSubmitGuess ? 1 : 0),
                        0,
                      ),
                    }).map((_, rowIndex) => (
                      <div key={`empty-${rowIndex}`} className="flex flex-wrap gap-2.5 opacity-80">
                        {Array.from({ length: pvpRound.wordLength }).map((__, index) => (
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
                  onClick={() => void handleSubmitGuess(false)}
                  disabled={!canSubmitGuess || isAutoSend || !isRowComplete || isSubmittingGuess}
                  className="rounded-full bg-brand-500 px-5 py-3 font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {isSubmittingGuess ? 'Enviando...' : 'Enviar guess'}
                </button>
              </div>

              <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                {boardMessage}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Ranking y finish order" description="El scoreboard se actualiza en tiempo real con placement y puntos acumulados.">
            <div className="space-y-3 text-sm text-slate-300">
              {pvpRound.scoreboard.map((scoreEntry, index) => {
                const player = pvpRound.players.find((candidate) => candidate.playerId === scoreEntry.playerId)

                return (
                  <div key={scoreEntry.playerId} className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">#{index + 1} · {scoreEntry.nickname}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {scoreEntry.currentPlacement === null ? 'Aún sin resolver' : `Terminó en puesto ${scoreEntry.currentPlacement}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">Puntos: {scoreEntry.totalPoints}</span>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">Intentos: {player?.attemptsLeft ?? 0}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-slate-500">Guesses enviados: {player?.guessHistory.length ?? 0}</p>
                    {player?.solved ? <p className="mt-2 text-emerald-300">Ya resolvió la palabra.</p> : null}
                    {player?.outOfAttempts ? <p className="mt-2 text-rose-300">Se quedó sin intentos.</p> : null}
                  </div>
                )
              })}
            </div>
          </SectionCard>
        </div>

        {renderChatPanel('Chat de la partida', 'Mensajes en tiempo real visibles para todos los jugadores del room.')}
      </div>
    )
  }

  if (activeRoom && coopRound) {
    return (
      <div className="space-y-8">
        <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/85 p-8 shadow-glow lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Partida cooperativa activa · fase 6.3</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Sala {activeRoom.roomCode}</h2>
            <p className="mt-3 max-w-2xl text-slate-300">
              Ronda {activeRoom.currentRoundNumber} de {activeRoom.totalRounds}. Todo el room comparte intentos e historial.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCopyRoomCode}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-brand-400 hover:text-white"
            >
              Copiar código
            </button>
            {isHost ? (
              <button
                type="button"
                onClick={handleCloseRoom}
                disabled={isClosingRoom}
                className="rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 transition hover:border-amber-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isClosingRoom ? 'Cerrando sala...' : 'Cerrar sala'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleLeaveRoom}
              disabled={isLeavingRoom}
              className="rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100 transition hover:border-rose-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLeavingRoom ? 'Saliendo...' : 'Salir de la sala'}
            </button>
            <span className={`rounded-full border px-4 py-2 text-sm ${connected ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
              {connected ? 'Conectado' : 'Reconectando'}
            </span>
          </div>
        </section>

        {copyFeedback ? <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">{copyFeedback}</div> : null}
        {actionMessage ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{actionMessage}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.85fr)]">
          <SectionCard title="Tablero compartido" description="Un único historial y un único contador de intentos para todo el equipo.">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2">Letras: {coopRound.wordLength}</span>
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2">Intentos compartidos: {coopRound.attemptsLeft}/{coopRound.totalAttempts}</span>
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2">Envío: {formatSubmissionMode(coopRound.submissionMode)}</span>
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2">Estado: {coopRound.status}</span>
                <span className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2">Score PVP: oculto</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                  <p className="text-slate-500">Progreso del equipo</p>
                  <p className="mt-1 font-medium text-white">Ganadas: {coopRound.roundsWon}</p>
                  <p className="mt-1 font-medium text-white">Perdidas: {coopRound.roundsLost}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                  <p className="text-slate-500">Modo de envío</p>
                  <p className="mt-1 font-medium text-white">{formatSubmissionMode(coopRound.submissionMode)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {coopRound.submissionMode === 'auto_send'
                      ? 'La fila completa se envía sola.'
                      : 'La fila completa requiere el botón de envío.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                  <p className="text-slate-500">Objetivo del modo</p>
                  <p className="mt-1 font-medium text-white">Resolver juntos sin ranking</p>
                  <p className="mt-1 text-xs text-slate-500">Cada error consume un intento compartido.</p>
                </div>
              </div>

              <div className="rounded-[28px] border-[5px] border-[#4659ba] bg-gradient-to-b from-[#7cb3ff] via-[#66a7ff] to-[#4d87ef] p-4 shadow-[0_18px_40px_rgba(30,64,175,0.35)]">
                <div className="rounded-[22px] border-[4px] border-[#3048a8] bg-[#88b7ff] p-3 shadow-[inset_0_-6px_0_rgba(28,64,150,0.35)]">
                  <div className="space-y-2.5">
                    {coopRound.guessHistory.map((guessRecord) => {
                      const sender = activeRoom.players.find((player) => player.playerId === guessRecord.submittedByPlayerId)

                      return (
                        <div key={`${guessRecord.guess}-${guessRecord.submittedAt}`} className="space-y-1">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-800/70">
                            {sender?.nickname ?? 'Jugador'} · guess compartido
                          </p>
                          {renderGuessRow(guessRecord.guess, guessRecord.result)}
                        </div>
                      )
                    })}

                    {canSubmitGuess ? (
                      <div className="flex flex-wrap gap-2.5">
                        {letters.map((letter, index) => (
                          <LetterBox
                            key={`coop-active-${index}`}
                            value={letter}
                            autoFocus={index === 0 && coopRound.guessHistory.length === 0}
                            ref={(element) => {
                              inputRefs.current[index] = element
                            }}
                            onChange={(value) => updateLetterAt(index, value)}
                            onKeyDown={(event) => handleBoardKeyDown(index, event)}
                          />
                        ))}
                      </div>
                    ) : null}

                    {Array.from({
                      length: Math.max(coopRound.totalAttempts - coopRound.guessHistory.length - (canSubmitGuess ? 1 : 0), 0),
                    }).map((_, rowIndex) => (
                      <div key={`coop-empty-${rowIndex}`} className="flex flex-wrap gap-2.5 opacity-80">
                        {Array.from({ length: coopRound.wordLength }).map((__, index) => (
                          <LetterBox key={`coop-empty-${rowIndex}-${index}`} value="" disabled />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleSubmitGuess(false)}
                  disabled={!canSubmitGuess || isAutoSend || !isRowComplete || isSubmittingGuess}
                  className="rounded-full bg-brand-500 px-5 py-3 font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {isSubmittingGuess ? 'Enviando...' : 'Enviar guess'}
                </button>
              </div>

              <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                {boardMessage}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Equipo" description="Todos ven el mismo progreso cooperativo en tiempo real.">
            <div className="space-y-3 text-sm text-slate-300">
              {activeRoom.players.map((player) => (
                <div key={player.playerId} className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{player.nickname}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {player.isHost ? <span className="rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-brand-200">Host</span> : null}
                      {player.playerId === currentPlayerId ? <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-200">Tú</span> : null}
                    </div>
                  </div>
                  <p className="mt-2 text-slate-500">Estado de conexión: {formatConnectionState(player.connectionState)}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {renderChatPanel('Chat del equipo', 'Coordinación en tiempo real mientras comparten intentos e historial.')}
      </div>
    )
  }

  if (summaryRoom && summaryRoom.summary.mode === 'coop') {
    const summaryCountdownSeconds = Math.max(
      Math.ceil((new Date(summaryRoom.summaryAutoAdvanceAt).getTime() - clockNow) / 1000),
      0,
    )

    return (
      <div className="space-y-8">
        <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/85 p-8 shadow-glow lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Resumen cooperativo · fase 7.2</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Sala {summaryRoom.roomCode}</h2>
            <p className="mt-3 max-w-2xl text-slate-300">
              La ronda terminó. Palabra secreta: <span className="font-semibold text-white">{summaryRoom.summary.secretWord.toUpperCase()}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-slate-200">
              Autoavance: {formatRemainingSeconds(summaryCountdownSeconds)}
            </span>
            <span className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-slate-200">
              Resultado: {summaryRoom.summary.outcome === 'won' ? 'Victoria' : 'Derrota'}
            </span>
            <span className={`rounded-full border px-4 py-2 text-sm ${connected ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
              {connected ? 'Conectado' : 'Reconectando'}
            </span>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SectionCard title="Resultado de la ronda" description="Co-op no usa puntos ni ranking; solo victorias y derrotas compartidas.">
            <div className="space-y-4 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                <p className="font-medium text-white">
                  {summaryRoom.summary.outcome === 'won' ? 'El equipo acertó la palabra.' : 'El equipo agotó los intentos compartidos.'}
                </p>
                <p className="mt-2 text-slate-400">Intentos restantes: {summaryRoom.summary.attemptsLeft}</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                <p>Rondas ganadas: <span className="font-medium text-white">{summaryRoom.summary.roundsWon}</span></p>
                <p className="mt-2">Rondas perdidas: <span className="font-medium text-white">{summaryRoom.summary.roundsLost}</span></p>
                <p className="mt-2 text-slate-500">Score PVP: no aplica en modo cooperativo.</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Estado del equipo" description="Todos los jugadores comparten el mismo resultado de ronda.">
            <div className="space-y-3 text-sm text-slate-300">
              {summaryRoom.players.map((player) => (
                <div key={player.playerId} className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                  <div>
                    <p className="font-medium text-white">{player.nickname}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{formatConnectionState(player.connectionState)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {player.isHost ? <span className="rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-brand-200">Host</span> : null}
                    {player.playerId === currentPlayerId ? <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-200">Tú</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">
          {summaryRoom.canCurrentPlayerAdvanceSummary ? (
            <button
              type="button"
              onClick={handleContinueRound}
              disabled={isContinuingRound}
              className="rounded-full bg-brand-500 px-5 py-3 font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isContinuingRound
                ? 'Continuando...'
                : summaryRoom.currentRoundNumber >= summaryRoom.totalRounds
                  ? 'Ver resultado final'
                  : 'Continuar a la siguiente ronda'}
            </button>
          ) : null}
          <span>
            {summaryRoom.canCurrentPlayerAdvanceSummary
              ? 'El host puede continuar manualmente o esperar el autoavance.'
              : 'Esperando que el host continúe o que llegue el autoavance.'}
          </span>
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
      <div className="space-y-8">
        <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/85 p-8 shadow-glow lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Resumen de ronda PVP · fase 7.2</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Sala {summaryRoom.roomCode}</h2>
            <p className="mt-3 max-w-2xl text-slate-300">
              La ronda terminó. Palabra secreta: <span className="font-semibold text-white">{summaryRoom.summary.secretWord.toUpperCase()}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-slate-200">
              Autoavance: {formatRemainingSeconds(summaryCountdownSeconds)}
            </span>
            <span className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-slate-200">
              Temporizador final: {formatRemainingSeconds(summaryRoom.summary.timer.remainingSeconds)}
            </span>
            <span className={`rounded-full border px-4 py-2 text-sm ${connected ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
              {connected ? 'Conectado' : 'Reconectando'}
            </span>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SectionCard title="Placements de la ronda" description="El orden se decide por el orden de recepción del servidor y ya no cambia.">
            <div className="space-y-3 text-sm text-slate-300">
              {summaryRoom.summary.placements.map((placement, index) => (
                <div key={placement.playerId} className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">#{index + 1} · {placement.nickname}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {placement.placement === null ? 'No resolvió a tiempo' : `Puesto ${placement.placement}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">Ronda: {placement.roundPoints}</span>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">Total: {placement.totalPoints}</span>
                    </div>
                  </div>
                  {placement.solved ? <p className="mt-2 text-emerald-300">Resolvió la palabra.</p> : <p className="mt-2 text-rose-300">No consiguió resolverla antes del cierre.</p>}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Scoreboard acumulado" description="La puntuación base y los bonos por 1.º, 2.º y 3.º lugar ya quedaron aplicados.">
            <div className="space-y-3 text-sm text-slate-300">
              {summaryRoom.summary.scoreboard.map((scoreEntry, index) => (
                <div key={scoreEntry.playerId} className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                  <div>
                    <p className="font-medium text-white">#{index + 1} · {scoreEntry.nickname}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {scoreEntry.currentPlacement === null ? 'Sin placement en esta ronda' : `Placement actual: ${scoreEntry.currentPlacement}`}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{scoreEntry.totalPoints} pts</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">
          {summaryRoom.canCurrentPlayerAdvanceSummary ? (
            <button
              type="button"
              onClick={handleContinueRound}
              disabled={isContinuingRound}
              className="rounded-full bg-brand-500 px-5 py-3 font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isContinuingRound
                ? 'Continuando...'
                : summaryRoom.currentRoundNumber >= summaryRoom.totalRounds
                  ? 'Ver resultado final'
                  : 'Continuar a la siguiente ronda'}
            </button>
          ) : null}
          <span>
            {summaryRoom.canCurrentPlayerAdvanceSummary
              ? 'El host puede continuar manualmente o esperar el autoavance.'
              : 'Esperando que el host continúe o que llegue el autoavance.'}
          </span>
        </div>
      </div>
    )
  }

  if (finalResultsRoom) {
    const currentFinalRoomPlayer = finalResultsRoom.players.find((player) => player.playerId === currentPlayerId) ?? null
    const isFinalRoomHost = currentFinalRoomPlayer?.isHost ?? false

    return (
      <div className="space-y-8">
        <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/85 p-8 shadow-glow lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Resultados finales · fase 7.3</p>
            <h2 className="mt-2 text-3xl font-bold text-white">Sala {finalResultsRoom.roomCode}</h2>
            <p className="mt-3 max-w-2xl text-slate-300">
              La partida terminó después de {finalResultsRoom.totalRounds} rondas y el resultado final permanece dentro del flujo de la sala.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCopyRoomCode}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-brand-400 hover:text-white"
            >
              Copiar código
            </button>
            {isFinalRoomHost ? (
              <button
                type="button"
                onClick={handleRematch}
                disabled={isRequestingRematch}
                className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isRequestingRematch ? 'Preparando revancha...' : 'Revancha'}
              </button>
            ) : null}
            {isFinalRoomHost ? (
              <button
                type="button"
                onClick={handleCloseRoom}
                disabled={isClosingRoom}
                className="rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 transition hover:border-amber-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isClosingRoom ? 'Cerrando sala...' : 'Cerrar sala'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleLeaveRoom}
              disabled={isLeavingRoom}
              className="rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100 transition hover:border-rose-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLeavingRoom ? 'Saliendo...' : 'Salir de la sala'}
            </button>
            <span className={`rounded-full border px-4 py-2 text-sm ${connected ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
              {connected ? 'Conectado' : 'Reconectando'}
            </span>
          </div>
        </section>

        {copyFeedback ? <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">{copyFeedback}</div> : null}
        {actionMessage ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{actionMessage}</div> : null}

        {finalResultsRoom.finalResults.mode === 'pvp' ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <SectionCard title="Ganador de la partida" description="El ranking final usa la puntuación acumulada de todas las rondas PVP.">
              <div className="space-y-4 text-sm text-slate-300">
                <div className="rounded-3xl border border-brand-400/20 bg-brand-500/10 px-5 py-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-brand-200">Campeón final</p>
                  <p className="mt-2 text-2xl font-bold text-white">{finalResultsRoom.finalResults.standings[0]?.nickname ?? 'Sin resultado'}</p>
                  <p className="mt-2 text-slate-300">Puntos totales: {finalResultsRoom.finalResults.standings[0]?.totalPoints ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                  <p>Jugadores clasificados: <span className="font-medium text-white">{finalResultsRoom.finalResults.standings.length}</span></p>
                  <p className="mt-2">Rondas jugadas: <span className="font-medium text-white">{finalResultsRoom.totalRounds}</span></p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Clasificación final" description="Resultado acumulado visible dentro de la misma sala, sin cambiar de ruta.">
              <div className="space-y-3 text-sm text-slate-300">
                {finalResultsRoom.finalResults.standings.map((standing) => (
                  <div key={standing.playerId} className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                    <div>
                      <p className="font-medium text-white">#{standing.finalPlacement} · {standing.nickname}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Resultado acumulado del match</p>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{standing.totalPoints} pts</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <SectionCard title="Resultado del equipo" description="El modo cooperativo resume el match por rondas ganadas y perdidas.">
              <div className="space-y-4 text-sm text-slate-300">
                <div className="rounded-3xl border border-brand-400/20 bg-brand-500/10 px-5 py-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-brand-200">Resultado final</p>
                  <p className="mt-2 text-2xl font-bold text-white">{buildCoopFinalMessage(finalResultsRoom.finalResults.roundsWon, finalResultsRoom.finalResults.roundsLost)}</p>
                  <p className="mt-2 text-slate-300">Rondas jugadas: {finalResultsRoom.finalResults.totalRounds}</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Resumen del match" description="Todas las rondas del equipo se mantienen visibles en el estado final de la sala.">
              <div className="space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">Rondas ganadas: <span className="font-medium text-white">{finalResultsRoom.finalResults.roundsWon}</span></div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">Rondas perdidas: <span className="font-medium text-white">{finalResultsRoom.finalResults.roundsLost}</span></div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">Jugadores en la sala: <span className="font-medium text-white">{finalResultsRoom.players.length}</span></div>
              </div>
            </SectionCard>
          </div>
        )}

        {renderChatPanel('Chat final de la sala', 'El room sigue abierto hasta que alguien salga o el host lo cierre.')}
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
            Crea una sala o únete desde la pantalla principal para cargar el lobby en tiempo real. Si aún conservas una sesión válida, la app intentará reanudarla automáticamente después de reconectarse.
          </p>
        </section>

        <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
          <span>{connected ? 'La conexión con el servidor está activa.' : 'Reconectando con el servidor...'}</span>
          <Link className="rounded-full border border-white/10 px-4 py-2 transition hover:border-brand-400 hover:text-white" to="/">
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/85 p-8 shadow-glow lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Lobby multijugador · fase 6.3</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Sala {lobbyRoom.roomCode}</h2>
          <p className="mt-3 max-w-2xl text-slate-300">
            {currentRoomPlayer ? `Conectado como ${currentRoomPlayer.nickname}${currentRoomPlayer.isHost ? ' · Anfitrión' : ''}.` : 'Esperando sincronización del jugador actual.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCopyRoomCode}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-brand-400 hover:text-white"
          >
            Copiar código
          </button>
          {isHost ? (
            <button
              type="button"
              onClick={handleCloseRoom}
              disabled={isClosingRoom}
              className="rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 transition hover:border-amber-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isClosingRoom ? 'Cerrando sala...' : 'Cerrar sala'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleLeaveRoom}
            disabled={isLeavingRoom}
            className="rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100 transition hover:border-rose-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLeavingRoom ? 'Saliendo...' : 'Salir de la sala'}
          </button>
          <span className={`rounded-full border px-4 py-2 text-sm ${connected ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
            {connected ? 'Conectado' : 'Reconectando'}
          </span>
        </div>
      </section>

      {copyFeedback ? <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">{copyFeedback}</div> : null}
      {actionMessage ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{actionMessage}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <SectionCard title="Jugadores en la sala" description="La lista debe actualizarse en tiempo real cuando alguien entra o sale del lobby.">
          <div className="space-y-3">
            {lobbyRoom.players.map((player) => (
              <div key={player.playerId} className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                <div>
                  <p className="font-medium text-white">{player.nickname}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{formatConnectionState(player.connectionState)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {player.isHost ? <span className="rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-xs text-brand-200">Host</span> : null}
                  {player.playerId === currentPlayerId ? <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">Tú</span> : null}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Estado de inicio" description="El anfitrión ya puede arrancar la partida sincronizada desde este lobby según el modo elegido.">
          <div className="space-y-4 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
              <p>
                Jugadores actuales: <span className="font-medium text-white">{lobbyRoom.players.length}</span>
              </p>
              <p className="mt-2">
                Mínimo requerido: <span className="font-medium text-white">{lobbyRoom.minPlayersRequired}</span>
              </p>
              <p className="mt-2">
                Inicio habilitado para ti: <span className="font-medium text-white">{lobbyRoom.canCurrentPlayerStartMatch ? 'Sí' : 'No'}</span>
              </p>
            </div>
            <p className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 text-slate-400">{getStartMessage(lobbyRoom, isHost)}</p>
            <button
              type="button"
              onClick={handleStartMatch}
              disabled={!isHost || isStartingMatch || !lobbyRoom.canCurrentPlayerStartMatch}
              className="rounded-full bg-brand-500 px-5 py-3 font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isStartingMatch ? 'Iniciando partida...' : lobbyRoom.settings.mode === 'coop' ? 'Iniciar partida cooperativa' : 'Iniciar ronda PVP'}
            </button>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Las salas del lobby se cerrarán automáticamente tras 5 minutos sin actividad.</p>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <SectionCard title="Configuración del lobby" description="El host puede editarla y todos los jugadores reciben el nuevo snapshot en tiempo real.">
          {isHost && settingsForm ? (
            <form className="space-y-4" onSubmit={handleSaveSettings}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2 text-sm text-slate-300">
                  <span className="font-medium text-white">Modo</span>
                  <select
                    name="mode"
                    value={settingsForm.mode}
                    onChange={handleSettingsChange}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none transition focus:border-brand-400"
                  >
                    <option value="pvp">PVP</option>
                    <option value="coop">Cooperativo</option>
                  </select>
                </label>

                <label className="block space-y-2 text-sm text-slate-300">
                  <span className="font-medium text-white">Modo de envío</span>
                  <select
                    name="submissionMode"
                    value={settingsForm.submissionMode}
                    onChange={handleSettingsChange}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none transition focus:border-brand-400"
                  >
                    <option value="auto_send">Autoenvío</option>
                    <option value="manual_submit">Envío manual</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2 text-sm text-slate-300">
                  <span className="font-medium text-white">Rondas</span>
                  <input
                    required
                    min={1}
                    type="number"
                    name="totalRounds"
                    value={settingsForm.totalRounds}
                    onChange={handleSettingsChange}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none transition focus:border-brand-400"
                  />
                </label>

                <label className="block space-y-2 text-sm text-slate-300">
                  <span className="font-medium text-white">Intentos por ronda</span>
                  <input
                    required
                    min={1}
                    type="number"
                    name="attemptsPerRound"
                    value={settingsForm.attemptsPerRound}
                    onChange={handleSettingsChange}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none transition focus:border-brand-400"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2 text-sm text-slate-300">
                  <span className="font-medium text-white">Temporizador PVP</span>
                  <select
                    name="pvpTimerSeconds"
                    value={settingsForm.mode === 'pvp' ? settingsForm.pvpTimerSeconds : ''}
                    onChange={handleSettingsChange}
                    disabled={settingsForm.mode !== 'pvp'}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none transition focus:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Sin temporizador</option>
                    <option value="60">60 segundos</option>
                    <option value="90">90 segundos</option>
                    <option value="120">120 segundos</option>
                    <option value="180">180 segundos</option>
                  </select>
                </label>

                <label className="block space-y-2 text-sm text-slate-300">
                  <span className="font-medium text-white">Máximo de jugadores</span>
                  <input
                    min={settingsForm.mode === 'pvp' ? 2 : 1}
                    type="number"
                    name="maxPlayers"
                    value={settingsForm.maxPlayers}
                    onChange={handleSettingsChange}
                    placeholder="Opcional"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none transition focus:border-brand-400"
                  />
                </label>
              </div>

              {settingsError ? <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{settingsError}</p> : null}

              <button
                type="submit"
                disabled={isSavingSettings}
                className="rounded-full bg-emerald-500 px-5 py-3 font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isSavingSettings ? 'Guardando...' : 'Guardar cambios del lobby'}
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-sm text-slate-300">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                  <p className="text-slate-500">Modo</p>
                  <p className="mt-1 font-medium text-white">{formatMode(lobbyRoom.settings.mode)}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                  <p className="text-slate-500">Envío</p>
                  <p className="mt-1 font-medium text-white">{formatSubmissionMode(lobbyRoom.settings.submissionMode)}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                  <p className="text-slate-500">Rondas</p>
                  <p className="mt-1 font-medium text-white">{lobbyRoom.settings.totalRounds}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                  <p className="text-slate-500">Intentos</p>
                  <p className="mt-1 font-medium text-white">{lobbyRoom.settings.attemptsPerRound}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                  <p className="text-slate-500">Temporizador</p>
                  <p className="mt-1 font-medium text-white">{formatTimer(lobbyRoom.settings.pvpTimerSeconds)}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                  <p className="text-slate-500">Máx. jugadores</p>
                  <p className="mt-1 font-medium text-white">{lobbyRoom.settings.maxPlayers ?? 'Sin límite'}</p>
                </div>
              </div>
              <p className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 text-slate-400">Solo el anfitrión puede editar la configuración del lobby.</p>
            </div>
          )}
        </SectionCard>

        {renderChatPanel('Chat del lobby', 'Mensajes en tiempo real visibles para todos los jugadores de la sala.')}
      </div>
    </div>
  )
}
