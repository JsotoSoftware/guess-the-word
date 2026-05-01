import { DEFAULT_ROOM_SETTINGS, type GameMode, type GuessSubmissionMode, type RoomSettings } from '@guess-the-word/shared'
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SectionCard } from '../components/ui/SectionCard'
import { useRoomSession } from '../contexts/room-session'

interface CreateRoomFormState {
  nickname: string
  mode: GameMode
  totalRounds: string
  attemptsPerRound: string
  pvpTimerSeconds: string
  submissionMode: GuessSubmissionMode
  maxPlayers: string
}

interface JoinRoomFormState {
  roomCode: string
  nickname: string
}

const initialCreateRoomForm: CreateRoomFormState = {
  nickname: '',
  mode: DEFAULT_ROOM_SETTINGS.mode,
  totalRounds: String(DEFAULT_ROOM_SETTINGS.totalRounds),
  attemptsPerRound: String(DEFAULT_ROOM_SETTINGS.attemptsPerRound),
  pvpTimerSeconds: String(DEFAULT_ROOM_SETTINGS.pvpTimerSeconds ?? ''),
  submissionMode: DEFAULT_ROOM_SETTINGS.submissionMode,
  maxPlayers: String(DEFAULT_ROOM_SETTINGS.maxPlayers ?? ''),
}

const initialJoinRoomForm: JoinRoomFormState = {
  roomCode: '',
  nickname: '',
}

function parseOptionalPositiveInteger(value: string): number | null {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  return Number.parseInt(trimmedValue, 10)
}

function buildRoomSettings(form: CreateRoomFormState): RoomSettings {
  return {
    mode: form.mode,
    totalRounds: Number.parseInt(form.totalRounds, 10),
    attemptsPerRound: Number.parseInt(form.attemptsPerRound, 10),
    pvpTimerSeconds: form.mode === 'pvp' ? parseOptionalPositiveInteger(form.pvpTimerSeconds) : null,
    submissionMode: form.submissionMode,
    maxPlayers: parseOptionalPositiveInteger(form.maxPlayers),
    roundSummaryAutoAdvanceSeconds: DEFAULT_ROOM_SETTINGS.roundSummaryAutoAdvanceSeconds,
  }
}

function roomModeLabel(mode: GameMode): string {
  return mode === 'pvp' ? 'PVP' : 'Cooperativo'
}

export function LandingPage() {
  const navigate = useNavigate()
  const { connected, room, createRoom, joinRoom } = useRoomSession()
  useEffect(() => {
    if (room) {
      navigate(`/room/${room.roomCode}`, { replace: true })
    }
  }, [navigate, room])
  const [createRoomForm, setCreateRoomForm] = useState<CreateRoomFormState>(initialCreateRoomForm)
  const [joinRoomForm, setJoinRoomForm] = useState<JoinRoomFormState>(initialJoinRoomForm)
  const [createRoomError, setCreateRoomError] = useState<string | null>(null)
  const [joinRoomError, setJoinRoomError] = useState<string | null>(null)
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [isJoiningRoom, setIsJoiningRoom] = useState(false)

  const roomSettingsPreview = useMemo(() => buildRoomSettings(createRoomForm), [createRoomForm])

  const handleCreateRoomChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target

    setCreateRoomForm((currentForm) => {
      const nextForm = {
        ...currentForm,
        [name]: value,
      }

      if (name === 'mode' && value === 'coop') {
        nextForm.pvpTimerSeconds = ''
      }

      if (name === 'mode' && value === 'pvp' && !nextForm.pvpTimerSeconds) {
        nextForm.pvpTimerSeconds = String(DEFAULT_ROOM_SETTINGS.pvpTimerSeconds ?? '')
      }

      return nextForm
    })
  }

  const handleJoinRoomChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setJoinRoomForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }))
  }

  const handleCreateRoomSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreateRoomError(null)
    setIsCreatingRoom(true)

    try {
      const response = await createRoom({
        nickname: createRoomForm.nickname,
        settings: buildRoomSettings(createRoomForm),
      })

      navigate(`/room/${response.room.roomCode}`)
    } catch (error) {
      setCreateRoomError(error instanceof Error ? error.message : 'No se pudo crear la sala.')
    } finally {
      setIsCreatingRoom(false)
    }
  }

  const handleJoinRoomSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setJoinRoomError(null)
    setIsJoiningRoom(true)

    try {
      const response = await joinRoom({
        roomCode: joinRoomForm.roomCode.trim().toUpperCase(),
        nickname: joinRoomForm.nickname,
      })

      navigate(`/room/${response.room.roomCode}`)
    } catch (error) {
      setJoinRoomError(error instanceof Error ? error.message : 'No se pudo unir a la sala.')
    } finally {
      setIsJoiningRoom(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-brand-400/20 bg-gradient-to-br from-brand-500/10 via-slate-900 to-slate-950 p-8 shadow-glow">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-brand-200">
            Fase 3.1
          </span>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${connected ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
            {connected ? 'Conectado al servidor' : 'Conectando al servidor...'}
          </span>
        </div>
        <h2 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-white">Crear o unirse a una sala real para comenzar la partida multijugador.</h2>
        <p className="mt-4 max-w-3xl text-base text-slate-300">
          Esta fase implementa el flujo inicial de creación y unión a salas con asignación de anfitrión, código compartible y configuración visible para todos los jugadores del lobby.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a className="rounded-full bg-brand-500 px-5 py-3 font-medium text-white transition hover:bg-brand-400" href="#create-room">
            Crear sala
          </a>
          <a className="rounded-full border border-white/10 px-5 py-3 font-medium text-slate-200 transition hover:border-white/30 hover:text-white" href="#join-room">
            Unirse a una sala
          </a>
          <Link className="rounded-full border border-white/10 px-5 py-3 font-medium text-slate-200 transition hover:border-white/30 hover:text-white" to="/demo/tablero">
            Ver tablero local
          </Link>
        </div>
      </section>

      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-300 shadow-glow">
        <p className="font-medium text-white">Vista previa de la sala a crear</p>
        <p className="mt-2 text-slate-400">
          Modo: {roomModeLabel(roomSettingsPreview.mode)} · Rondas: {roomSettingsPreview.totalRounds} · Intentos: {roomSettingsPreview.attemptsPerRound} · Envío:{' '}
          {roomSettingsPreview.submissionMode === 'auto_send' ? 'Autoenvío' : 'Manual'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Crear sala" description="El anfitrión define el modo y la configuración inicial del lobby.">
          <form id="create-room" className="space-y-4" onSubmit={handleCreateRoomSubmit}>
            <label className="block space-y-2 text-sm text-slate-300">
              <span className="font-medium text-white">Apodo</span>
              <input
                required
                name="nickname"
                value={createRoomForm.nickname}
                onChange={handleCreateRoomChange}
                placeholder="Ej. Ana"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none transition focus:border-brand-400"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm text-slate-300">
                <span className="font-medium text-white">Modo de juego</span>
                <select
                  name="mode"
                  value={createRoomForm.mode}
                  onChange={handleCreateRoomChange}
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
                  value={createRoomForm.submissionMode}
                  onChange={handleCreateRoomChange}
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
                  value={createRoomForm.totalRounds}
                  onChange={handleCreateRoomChange}
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
                  value={createRoomForm.attemptsPerRound}
                  onChange={handleCreateRoomChange}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none transition focus:border-brand-400"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm text-slate-300">
                <span className="font-medium text-white">Temporizador PVP</span>
                <select
                  name="pvpTimerSeconds"
                  value={createRoomForm.mode === 'pvp' ? createRoomForm.pvpTimerSeconds : ''}
                  onChange={handleCreateRoomChange}
                  disabled={createRoomForm.mode !== 'pvp'}
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
                  min={createRoomForm.mode === 'pvp' ? 2 : 1}
                  type="number"
                  name="maxPlayers"
                  value={createRoomForm.maxPlayers}
                  onChange={handleCreateRoomChange}
                  placeholder="Opcional"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none transition focus:border-brand-400"
                />
              </label>
            </div>

            {createRoomError ? <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{createRoomError}</p> : null}

            <button
              type="submit"
              disabled={isCreatingRoom}
              className="rounded-full bg-brand-500 px-5 py-3 font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isCreatingRoom ? 'Creando sala...' : 'Crear sala'}
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Unirse a una sala" description="Ingresa el código y tu apodo para entrar a un lobby existente.">
          <form id="join-room" className="space-y-4" onSubmit={handleJoinRoomSubmit}>
            <label className="block space-y-2 text-sm text-slate-300">
              <span className="font-medium text-white">Código de sala</span>
              <input
                required
                name="roomCode"
                value={joinRoomForm.roomCode}
                onChange={handleJoinRoomChange}
                placeholder="Ej. ABC123"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 uppercase outline-none transition focus:border-brand-400"
              />
            </label>

            <label className="block space-y-2 text-sm text-slate-300">
              <span className="font-medium text-white">Apodo</span>
              <input
                required
                name="nickname"
                value={joinRoomForm.nickname}
                onChange={handleJoinRoomChange}
                placeholder="Ej. Luis"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none transition focus:border-brand-400"
              />
            </label>

            <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
              Validaciones implementadas: sala inexistente, sala cerrada, sala llena y apodo repetido dentro del mismo lobby.
            </div>

            {joinRoomError ? <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{joinRoomError}</p> : null}

            <button
              type="submit"
              disabled={isJoiningRoom}
              className="rounded-full bg-emerald-500 px-5 py-3 font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isJoiningRoom ? 'Uniéndose...' : 'Unirse a la sala'}
            </button>
          </form>
        </SectionCard>
      </div>
    </div>
  )
}
