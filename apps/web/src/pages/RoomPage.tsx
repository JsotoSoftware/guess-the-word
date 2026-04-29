import { type LobbyRoomSnapshot } from '@guess-the-word/shared'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SectionCard } from '../components/ui/SectionCard'
import { useRoomSession } from '../contexts/room-session'

function formatSubmissionMode(value: LobbyRoomSnapshot['settings']['submissionMode']): string {
  return value === 'auto_send' ? 'Autoenvío' : 'Envío manual'
}

function formatTimer(value: number | null): string {
  return value === null ? 'Sin temporizador' : `${value} segundos`
}

function formatMode(value: LobbyRoomSnapshot['settings']['mode']): string {
  return value === 'pvp' ? 'PVP' : 'Cooperativo'
}

export function RoomPage() {
  const { code = '' } = useParams()
  const { room, connected, currentPlayerId } = useRoomSession()
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  const currentRoom = useMemo(() => {
    if (!room || room.roomCode !== code.toUpperCase() || room.viewState !== 'lobby') {
      return null
    }

    return room as LobbyRoomSnapshot
  }, [code, room])

  const currentPlayer = currentRoom?.players.find((player) => player.playerId === currentPlayerId) ?? null

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
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Lobby multijugador</p>
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
          <span className={`rounded-full border px-4 py-2 text-sm ${connected ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
            {connected ? 'Conectado' : 'Reconectando'}
          </span>
          <span className="rounded-full border border-brand-400/30 bg-brand-400/10 px-4 py-2 text-sm text-brand-200">
            {formatSubmissionMode(currentRoom.settings.submissionMode)}
          </span>
        </div>
      </section>

      {copyFeedback ? <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">{copyFeedback}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <SectionCard title="Jugadores en la sala" description="Todos los clientes conectados al mismo código deben verse en tiempo real.">
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

        <SectionCard title="Configuración del lobby" description="Persistida por el backend y visible para todos los participantes.">
          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
              <p className="text-slate-500">Modo</p>
              <p className="mt-1 font-medium text-white">{formatMode(currentRoom.settings.mode)}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
              <p className="text-slate-500">Rondas</p>
              <p className="mt-1 font-medium text-white">{currentRoom.settings.totalRounds}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
              <p className="text-slate-500">Intentos por ronda</p>
              <p className="mt-1 font-medium text-white">{currentRoom.settings.attemptsPerRound}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
              <p className="text-slate-500">Temporizador</p>
              <p className="mt-1 font-medium text-white">{formatTimer(currentRoom.settings.pvpTimerSeconds)}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
              <p className="text-slate-500">Modo de envío</p>
              <p className="mt-1 font-medium text-white">{formatSubmissionMode(currentRoom.settings.submissionMode)}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
              <p className="text-slate-500">Máximo de jugadores</p>
              <p className="mt-1 font-medium text-white">{currentRoom.settings.maxPlayers ?? 'Sin límite'}</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
            <p>
              Jugadores actuales: <span className="font-medium text-white">{currentRoom.players.length}</span>
            </p>
            <p className="mt-2">
              Inicio permitido ahora: <span className="font-medium text-white">{currentRoom.canCurrentPlayerStartMatch ? 'Sí' : 'No'}</span>
            </p>
            <p className="mt-2">
              Requisito mínimo para este modo: <span className="font-medium text-white">{currentRoom.minPlayersRequired}</span>
            </p>
          </div>
        </SectionCard>
      </div>

      <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
        <span>La edición de ajustes del host, el inicio de partida y la sincronización avanzada continúan en la fase 3.2.</span>
        <Link className="rounded-full border border-white/10 px-4 py-2 transition hover:border-brand-400 hover:text-white" to="/">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
