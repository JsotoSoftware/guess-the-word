import { DEFAULT_ROOM_SETTINGS, type GameMode, type GuessSubmissionMode, type RoomSettings } from '@guess-the-word/shared'
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LandingActionButton } from '../features/landing/LandingActionButton'
import { LandingPanel } from '../features/landing/LandingPanel'
import { useRoomSession } from '../contexts/room-session'

interface CreateRoomFormState {
  nickname: string
  mode: GameMode
  totalRounds: string
  attemptsPerRound: string
  pvpTimerSeconds: string
  submissionMode: GuessSubmissionMode
  maxPlayers: string
  maxWordLength: string
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
  maxWordLength: String(DEFAULT_ROOM_SETTINGS.maxWordLength ?? ''),
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
    maxWordLength: parseOptionalPositiveInteger(form.maxWordLength),
    roundSummaryAutoAdvanceSeconds: DEFAULT_ROOM_SETTINGS.roundSummaryAutoAdvanceSeconds,
  }
}

const inputClassName = 'w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-brand-300'
const helperCardClassName = 'rounded-2xl border border-white/8 bg-slate-950/55 px-4 py-3 text-sm text-slate-300'

export function LandingPage() {
  const navigate = useNavigate()
  const { room, createRoom, joinRoom } = useRoomSession()
  const [activePanel, setActivePanel] = useState<'create' | 'join' | null>(null)
  const [createRoomForm, setCreateRoomForm] = useState<CreateRoomFormState>(initialCreateRoomForm)
  const [joinRoomForm, setJoinRoomForm] = useState<JoinRoomFormState>(initialJoinRoomForm)
  const [createRoomError, setCreateRoomError] = useState<string | null>(null)
  const [joinRoomError, setJoinRoomError] = useState<string | null>(null)
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [isJoiningRoom, setIsJoiningRoom] = useState(false)

  useEffect(() => {
    if (room) {
      navigate(`/room/${room.roomCode}`, { replace: true })
    }
  }, [navigate, room])

  const handleCreateRoomChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
    <div className="flex flex-1 flex-col justify-center py-4 sm:py-8">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="space-y-3 px-1 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Juega desde cualquier lugar</h1>
          <p className="mx-auto max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Elige una opción para empezar. La configuración detallada de la partida también se puede ajustar dentro de la sala.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <LandingActionButton
            title="Crear sala"
            description="Abre una sala nueva con tus reglas y comparte el código con tu grupo."
            icon="+"
            active={activePanel === 'create'}
            accent="brand"
            onClick={() => {
              setCreateRoomError(null)
              setActivePanel('create')
            }}
          />
          <LandingActionButton
            title="Unirse"
            description="Entra rápido con un código y tu apodo."
            icon="→"
            active={activePanel === 'join'}
            accent="emerald"
            onClick={() => {
              setJoinRoomError(null)
              setActivePanel('join')
            }}
          />
        </div>

        {activePanel === 'create' ? (
          <LandingPanel
            title="Crear sala"
            description="Empieza con lo esencial. Si necesitas más control, puedes ajustar el resto antes de iniciar la partida."
          >
            <form className="space-y-4" onSubmit={handleCreateRoomSubmit}>
              <label className="block space-y-2 text-sm text-slate-200">
                <span className="font-medium text-white">Apodo</span>
                <input
                  required
                  name="nickname"
                  value={createRoomForm.nickname}
                  onChange={handleCreateRoomChange}
                  placeholder="Ej. Ana"
                  className={inputClassName}
                />
              </label>

              <div className="space-y-3">
                <span className="block text-sm font-medium text-white">Modo de juego</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setCreateRoomForm((currentForm) => ({
                      ...currentForm,
                      mode: 'pvp',
                      pvpTimerSeconds: currentForm.pvpTimerSeconds || String(DEFAULT_ROOM_SETTINGS.pvpTimerSeconds ?? ''),
                    }))}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${createRoomForm.mode === 'pvp' ? 'border-brand-300 bg-brand-400/15 text-white' : 'border-white/10 bg-slate-950/55 text-slate-200 hover:border-white/20'}`}
                  >
                    <span className="block text-base font-semibold">PVP</span>
                    <span className="mt-1 block text-sm text-slate-300">Cada jugador compite por resolver primero.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateRoomForm((currentForm) => ({
                      ...currentForm,
                      mode: 'coop',
                      pvpTimerSeconds: '',
                    }))}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${createRoomForm.mode === 'coop' ? 'border-brand-300 bg-brand-400/15 text-white' : 'border-white/10 bg-slate-950/55 text-slate-200 hover:border-white/20'}`}
                  >
                    <span className="block text-base font-semibold">Cooperativo</span>
                    <span className="mt-1 block text-sm text-slate-300">Todo el grupo comparte intentos e historial.</span>
                  </button>
                </div>
              </div>

              <div className={helperCardClassName}>
                <p className="font-medium text-white">Listo para jugar</p>
                <p className="mt-1 leading-6 text-slate-300">
                  Crearemos la sala con valores equilibrados por defecto para que puedas empezar rápido.
                </p>
              </div>

              <details className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                <summary className="cursor-pointer list-none font-medium text-white marker:hidden">
                  Más opciones de la sala
                </summary>

                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="font-medium text-white">Rondas</span>
                      <input
                        required
                        min={1}
                        type="number"
                        name="totalRounds"
                        value={createRoomForm.totalRounds}
                        onChange={handleCreateRoomChange}
                        className={inputClassName}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="font-medium text-white">Intentos por ronda</span>
                      <input
                        required
                        min={1}
                        type="number"
                        name="attemptsPerRound"
                        value={createRoomForm.attemptsPerRound}
                        onChange={handleCreateRoomChange}
                        className={inputClassName}
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="font-medium text-white">Envío de intentos</span>
                      <select
                        name="submissionMode"
                        value={createRoomForm.submissionMode}
                        onChange={handleCreateRoomChange}
                        className={inputClassName}
                      >
                        <option value="auto_send">Automático</option>
                        <option value="manual_submit">Manual</option>
                      </select>
                    </label>

                    <label className="block space-y-2">
                      <span className="font-medium text-white">Máximo de jugadores</span>
                      <input
                        min={createRoomForm.mode === 'pvp' ? 2 : 1}
                        type="number"
                        name="maxPlayers"
                        value={createRoomForm.maxPlayers}
                        onChange={handleCreateRoomChange}
                        placeholder="Sin límite"
                        className={inputClassName}
                      />
                    </label>
                  </div>

                  <label className="block space-y-2">
                    <span className="font-medium text-white">Longitud máxima de palabra</span>
                    <select
                      name="maxWordLength"
                      value={createRoomForm.maxWordLength}
                      onChange={handleCreateRoomChange}
                      className={inputClassName}
                    >
                      <option value="">Cualquiera</option>
                      <option value="4">Hasta 4 letras</option>
                      <option value="5">Hasta 5 letras</option>
                      <option value="6">Hasta 6 letras</option>
                      <option value="7">Hasta 7 letras</option>
                      <option value="8">Hasta 8 letras</option>
                      <option value="9">Hasta 9 letras</option>
                    </select>
                  </label>

                  {createRoomForm.mode === 'pvp' ? (
                    <label className="block space-y-2">
                      <span className="font-medium text-white">Temporizador</span>
                      <select
                        name="pvpTimerSeconds"
                        value={createRoomForm.pvpTimerSeconds}
                        onChange={handleCreateRoomChange}
                        className={inputClassName}
                      >
                        <option value="">Sin temporizador</option>
                        <option value="60">60 segundos</option>
                        <option value="90">90 segundos</option>
                        <option value="120">120 segundos</option>
                        <option value="180">180 segundos</option>
                      </select>
                    </label>
                  ) : null}
                </div>
              </details>

              {createRoomError ? (
                <p className="rounded-2xl border border-rose-500/30 bg-rose-500/12 px-4 py-3 text-sm text-rose-100">
                  {createRoomError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isCreatingRoom}
                className="w-full rounded-full bg-brand-500 px-5 py-3.5 text-base font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isCreatingRoom ? 'Creando sala...' : 'Crear sala'}
              </button>
            </form>
          </LandingPanel>
        ) : null}

        {activePanel === 'join' ? (
          <LandingPanel
            title="Unirse a una sala"
            description="Solo necesitas el código de la sala y tu apodo para entrar."
          >
            <form className="space-y-4" onSubmit={handleJoinRoomSubmit}>
              <label className="block space-y-2 text-sm text-slate-200">
                <span className="font-medium text-white">Código de sala</span>
                <input
                  required
                  name="roomCode"
                  value={joinRoomForm.roomCode}
                  onChange={handleJoinRoomChange}
                  placeholder="Ej. ABC123"
                  className={`${inputClassName} uppercase tracking-[0.18em]`}
                />
              </label>

              <label className="block space-y-2 text-sm text-slate-200">
                <span className="font-medium text-white">Apodo</span>
                <input
                  required
                  name="nickname"
                  value={joinRoomForm.nickname}
                  onChange={handleJoinRoomChange}
                  placeholder="Ej. Luis"
                  className={inputClassName}
                />
              </label>

              <div className={helperCardClassName}>
                <p className="font-medium text-white">Entrada rápida</p>
                <p className="mt-1 leading-6 text-slate-300">
                  Si el código es válido, entrarás directamente al lobby con el resto del grupo.
                </p>
              </div>

              {joinRoomError ? (
                <p className="rounded-2xl border border-rose-500/30 bg-rose-500/12 px-4 py-3 text-sm text-rose-100">
                  {joinRoomError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isJoiningRoom}
                className="w-full rounded-full bg-emerald-500 px-5 py-3.5 text-base font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isJoiningRoom ? 'Uniéndote...' : 'Entrar a la sala'}
              </button>
            </form>
          </LandingPanel>
        ) : null}

        {!activePanel ? (
          <div className="rounded-[28px] border border-white/10 bg-slate-900/72 px-5 py-4 text-center text-sm leading-6 text-slate-300 shadow-glow">
            Selecciona <span className="font-semibold text-white">Crear sala</span> o <span className="font-semibold text-white">Unirse</span> para continuar.
          </div>
        ) : null}
      </section>
    </div>
  )
}
