import { type GuessSubmissionMode, type LobbyRoomSnapshot, type RoomSettings } from '@guess-the-word/shared'
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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

function formatSubmissionMode(value: LobbyRoomSnapshot['settings']['submissionMode']): string {
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

  if (room.settings.mode === 'pvp' && room.players.length < 2) {
    return 'PVP requiere al menos 2 jugadores para habilitar el inicio.'
  }

  if (room.settings.mode === 'coop') {
    return 'En cooperativo el inicio ya está habilitado incluso con un solo jugador.'
  }

  return 'La sala ya cumple las restricciones para iniciar la partida.'
}

export function RoomPage() {
  const navigate = useNavigate()
  const { code = '' } = useParams()
  const { room, connected, currentPlayerId, updateRoomSettings, leaveRoom } = useRoomSession()
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isLeavingRoom, setIsLeavingRoom] = useState(false)

  const currentRoom = useMemo(() => {
    if (!room || room.roomCode !== code.toUpperCase() || room.viewState !== 'lobby') {
      return null
    }

    return room as LobbyRoomSnapshot
  }, [code, room])

  const [settingsForm, setSettingsForm] = useState<LobbySettingsFormState | null>(
    currentRoom ? toSettingsFormState(currentRoom.settings) : null,
  )

  useEffect(() => {
    if (currentRoom) {
      setSettingsForm(toSettingsFormState(currentRoom.settings))
    }
  }, [currentRoom])

  const currentPlayer = currentRoom?.players.find((player) => player.playerId === currentPlayerId) ?? null
  const isHost = currentPlayer?.isHost ?? false

  const handleCopyRoomCode = async () => {
    if (!currentRoom) {
      return
    }

    try {
      await navigator.clipboard.writeText(currentRoom.roomCode)
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

    if (!currentRoom || !settingsForm) {
      return
    }

    setSettingsError(null)
    setActionMessage(null)
    setIsSavingSettings(true)

    try {
      await updateRoomSettings({
        roomCode: currentRoom.roomCode,
        settings: buildRoomSettings(settingsForm, currentRoom),
      })
      setActionMessage('Configuración sincronizada con todos los jugadores del lobby.')
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'No se pudo guardar la configuración.')
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleLeaveRoom = async () => {
    if (!currentRoom) {
      return
    }

    setActionMessage(null)
    setSettingsError(null)
    setIsLeavingRoom(true)

    try {
      await leaveRoom({ roomCode: currentRoom.roomCode })
      navigate('/')
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'No se pudo salir de la sala.')
      setIsLeavingRoom(false)
    }
  }

  const handleStartPreview = () => {
    if (!currentRoom) {
      return
    }

    setActionMessage(
      currentRoom.canCurrentPlayerStartMatch
        ? 'La sala ya superó las restricciones de inicio. El arranque real de la partida se conectará en la fase 4/5.'
        : getStartMessage(currentRoom, isHost),
    )
  }

  if (!currentRoom) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/10 bg-slate-900/85 p-8 shadow-glow">
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Sala no disponible</p>
          <h2 className="mt-2 text-3xl font-bold text-white">No hay una sesión activa para la sala {code.toUpperCase()}.</h2>
          <p className="mt-3 max-w-2xl text-slate-300">
            Crea una sala o únete desde la pantalla principal para cargar el lobby en tiempo real. El flujo de reanudación después de refrescar la página se implementará en una fase posterior.
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
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Lobby multijugador · fase 3.2</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Sala {currentRoom.roomCode}</h2>
          <p className="mt-3 max-w-2xl text-slate-300">
            {currentPlayer ? `Conectado como ${currentPlayer.nickname}${currentPlayer.isHost ? ' · Anfitrión' : ''}.` : 'Esperando sincronización del jugador actual.'}
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
            {currentRoom.players.map((player) => (
              <div key={player.playerId} className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
                <div>
                  <p className="font-medium text-white">{player.nickname}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{player.connectionState}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {player.isHost ? <span className="rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-xs text-brand-200">Host</span> : null}
                  {player.playerId === currentPlayerId ? <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">Tú</span> : null}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Estado de inicio" description="Las restricciones cambian según el modo de la sala.">
          <div className="space-y-4 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
              <p>
                Jugadores actuales: <span className="font-medium text-white">{currentRoom.players.length}</span>
              </p>
              <p className="mt-2">
                Mínimo requerido: <span className="font-medium text-white">{currentRoom.minPlayersRequired}</span>
              </p>
              <p className="mt-2">
                Inicio habilitado para ti: <span className="font-medium text-white">{currentRoom.canCurrentPlayerStartMatch ? 'Sí' : 'No'}</span>
              </p>
            </div>
            <p className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 text-slate-400">{getStartMessage(currentRoom, isHost)}</p>
            <button
              type="button"
              onClick={handleStartPreview}
              disabled={!isHost}
              className="rounded-full bg-brand-500 px-5 py-3 font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {currentRoom.canCurrentPlayerStartMatch ? 'Inicio disponible' : 'Revisar restricción de inicio'}
            </button>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">La activación real de la ronda llega en las fases 4 y 5.</p>
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
                  <p className="mt-1 font-medium text-white">{formatMode(currentRoom.settings.mode)}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                  <p className="text-slate-500">Envío</p>
                  <p className="mt-1 font-medium text-white">{formatSubmissionMode(currentRoom.settings.submissionMode)}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                  <p className="text-slate-500">Rondas</p>
                  <p className="mt-1 font-medium text-white">{currentRoom.settings.totalRounds}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                  <p className="text-slate-500">Intentos</p>
                  <p className="mt-1 font-medium text-white">{currentRoom.settings.attemptsPerRound}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                  <p className="text-slate-500">Temporizador</p>
                  <p className="mt-1 font-medium text-white">{formatTimer(currentRoom.settings.pvpTimerSeconds)}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                  <p className="text-slate-500">Máx. jugadores</p>
                  <p className="mt-1 font-medium text-white">{currentRoom.settings.maxPlayers ?? 'Sin límite'}</p>
                </div>
              </div>
              <p className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 text-slate-400">Solo el anfitrión puede editar la configuración del lobby.</p>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Chat del lobby" description="La visibilidad del panel queda lista aunque la mensajería real llega en la fase 6.">
          <div className="space-y-3 text-sm text-slate-300">
            <div className="min-h-48 rounded-2xl border border-white/5 bg-slate-950/60 p-4 text-slate-400">
              {currentRoom.chatMessages && currentRoom.chatMessages.length > 0 ? (
                currentRoom.chatMessages.map((message) => (
                  <div key={message.messageId} className="mb-3 rounded-2xl border border-white/5 bg-slate-900/70 px-3 py-2">
                    <p className="font-medium text-white">{message.senderNickname}</p>
                    <p className="mt-1">{message.text}</p>
                  </div>
                ))
              ) : (
                <p>Aún no hay mensajes en el lobby. El envío y sincronización de chat se implementan en la fase 6.</p>
              )}
            </div>
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-3 text-slate-500">
              Ready-check no requerido para el MVP actual; el host inicia manualmente cuando corresponda.
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
