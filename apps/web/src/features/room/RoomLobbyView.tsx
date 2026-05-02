import type { LobbyRoomSnapshot, RoomSettings } from '@guess-the-word/shared'
import type { ChangeEvent, FormEvent } from 'react'
import { RoomChatDock } from './RoomChatDock'
import { RoomIconButton } from './RoomIconButton'
import { RoomPanel } from './RoomPanel'
import { copyIcon, closeIcon, exitIcon } from './room-icons'
import { formatConnectionState, formatMode, formatSubmissionMode, formatTimer, getStartMessage } from './room-formatters'

interface LobbySettingsFormState {
  mode: RoomSettings['mode']
  totalRounds: string
  attemptsPerRound: string
  pvpTimerSeconds: string
  submissionMode: RoomSettings['submissionMode']
  maxPlayers: string
  maxWordLength: string
}

interface RoomLobbyViewProps {
  room: LobbyRoomSnapshot
  currentPlayerId: string | null
  isHost: boolean
  settingsForm: LobbySettingsFormState | null
  settingsError: string | null
  actionMessage: string | null
  copyFeedback: string | null
  isSavingSettings: boolean
  isStartingMatch: boolean
  isSendingChat: boolean
  isLeavingRoom: boolean
  isClosingRoom: boolean
  chatDraft: string
  unreadCount: number
  isMobileChatOpen: boolean
  onSettingsChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onSaveSettings: (event: FormEvent<HTMLFormElement>) => void
  onStartMatch: () => void
  onSendChat: (event: FormEvent<HTMLFormElement>) => void
  onChatDraftChange: (value: string) => void
  onChatOpenChange: (open: boolean) => void
  onCopyRoomCode: () => void
  onLeaveRoom: () => void
  onCloseRoom: () => void
}

function getPlayerInitial(nickname: string) {
  return Array.from(nickname)[0]?.toUpperCase() ?? '?'
}

function statCard(icon: string, label: string, value: string, helper?: string) {
  return (
    <div className="min-w-0 rounded-[26px] border border-white/8 bg-slate-950/55 px-4 py-4 text-slate-200 shadow-[inset_0_-3px_0_rgba(15,23,42,0.18)]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
          <p className="mt-3 text-[clamp(1.45rem,2vw,1.9rem)] font-black leading-[1.02] tracking-tight text-white">{value}</p>
          {helper ? <p className="mt-1 text-sm font-semibold leading-5 text-slate-300">{helper}</p> : null}
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-2xl">{icon}</span>
      </div>
    </div>
  )
}

export function RoomLobbyView({
  room,
  currentPlayerId,
  isHost,
  settingsForm,
  settingsError,
  actionMessage,
  copyFeedback,
  isSavingSettings,
  isStartingMatch,
  isSendingChat,
  isLeavingRoom,
  isClosingRoom,
  chatDraft,
  unreadCount,
  isMobileChatOpen,
  onSettingsChange,
  onSaveSettings,
  onStartMatch,
  onSendChat,
  onChatDraftChange,
  onChatOpenChange,
  onCopyRoomCode,
  onLeaveRoom,
  onCloseRoom,
}: RoomLobbyViewProps) {
  const currentRoomPlayer = room.players.find((player) => player.playerId === currentPlayerId) ?? null

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/88 p-5 shadow-glow sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(39,177,255,0.2),transparent_34%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-brand-300/30 bg-brand-400/12 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-brand-100">
                Sala {room.roomCode}
              </span>
              {isHost ? (
                <span className="rounded-full border border-amber-300/30 bg-amber-500/12 px-3 py-1 text-xs font-black text-amber-100">
                  👑 Anfitrión
                </span>
              ) : null}
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-[2.65rem]">Listos para jugar</h1>
              <p className="mt-2 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                {currentRoomPlayer ? `Hola, ${currentRoomPlayer.nickname}. Reúne al equipo y arranquen cuando quieran.` : 'Estamos preparando tu sesión en la sala.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start">
            <RoomIconButton label="Copiar código" icon={copyIcon} tone="accent" onClick={onCopyRoomCode} />
            {isHost ? (
              <RoomIconButton label="Cerrar sala" icon={closeIcon} tone="warning" onClick={onCloseRoom} disabled={isClosingRoom} />
            ) : null}
            <RoomIconButton label="Salir de la sala" icon={exitIcon} tone="danger" onClick={onLeaveRoom} disabled={isLeavingRoom} />
          </div>
        </div>

        {copyFeedback ? <p className="relative mt-4 rounded-2xl border border-white/8 bg-white/6 px-4 py-3 text-base text-slate-100">{copyFeedback}</p> : null}
        {actionMessage ? <p className="relative mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/12 px-4 py-3 text-base text-emerald-100">{actionMessage}</p> : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <RoomPanel title="🧑‍🚀 Jugadores" description="Todo el grupo aparece aquí en tiempo real.">
            <div className="space-y-3">
              {room.players.map((player) => (
                <article
                  key={player.playerId}
                  className="flex items-center justify-between gap-3 rounded-[26px] border border-white/8 bg-slate-950/55 px-4 py-4 text-slate-300"
                >
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
                </article>
              ))}
            </div>
          </RoomPanel>

          <RoomPanel title="🎮 Partida" description="Solo lo importante para empezar rápido.">
            <div className={`grid gap-3 sm:grid-cols-2 ${isHost ? '2xl:grid-cols-4' : '2xl:grid-cols-3'}`}>
              {statCard('🎲', 'Modo', formatMode(room.settings.mode))}
              {statCard('👥', 'Jugadores', `${room.players.length}${room.settings.maxPlayers ? ` / ${room.settings.maxPlayers}` : ''}`)}
              {isHost ? statCard('🚦', 'Mínimo', String(room.minPlayersRequired), 'para empezar') : null}
              {statCard('🎯', 'Intentos', String(room.settings.attemptsPerRound), 'por ronda')}
              {statCard('🔠', 'Largo máx.', room.settings.maxWordLength ? `${room.settings.maxWordLength}` : 'Cualquiera')}
            </div>

            <div className="mt-4 rounded-[26px] border border-brand-300/20 bg-brand-400/10 px-4 py-4 text-base font-semibold leading-7 text-brand-50">
              {getStartMessage(room, isHost)}
            </div>

            {isHost ? (
              <button
                type="button"
                onClick={onStartMatch}
                disabled={isStartingMatch || !room.canCurrentPlayerStartMatch}
                className="mt-4 w-full rounded-full bg-brand-500 px-5 py-4 text-lg font-black text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:w-auto"
              >
                {isStartingMatch ? 'Iniciando...' : '🚀 Empezar partida'}
              </button>
            ) : (
              <p className="mt-4 text-base text-slate-400">Solo el anfitrión puede empezar.</p>
            )}
          </RoomPanel>

          <RoomPanel
            title={isHost ? '⚙️ Ajustes de la sala' : '⚙️ Ajustes'}
            description={isHost ? 'Cambia la partida antes de empezar.' : 'Solo el anfitrión puede cambiar esto.'}
          >
            {isHost && settingsForm ? (
              <form className="space-y-4" onSubmit={onSaveSettings}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2 text-base text-slate-300">
                    <span className="font-black text-white">Modo</span>
                    <select
                      name="mode"
                      value={settingsForm.mode}
                      onChange={onSettingsChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-base text-white outline-none transition focus:border-brand-300"
                    >
                      <option value="pvp">PVP</option>
                      <option value="coop">Cooperativo</option>
                    </select>
                  </label>

                  <label className="block space-y-2 text-base text-slate-300">
                    <span className="font-black text-white">Envío</span>
                    <select
                      name="submissionMode"
                      value={settingsForm.submissionMode}
                      onChange={onSettingsChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-base text-white outline-none transition focus:border-brand-300"
                    >
                      <option value="auto_send">Automático</option>
                      <option value="manual_submit">Manual</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2 text-base text-slate-300">
                    <span className="font-black text-white">Rondas</span>
                    <input
                      required
                      min={1}
                      type="number"
                      name="totalRounds"
                      value={settingsForm.totalRounds}
                      onChange={onSettingsChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-base text-white outline-none transition focus:border-brand-300"
                    />
                  </label>

                  <label className="block space-y-2 text-base text-slate-300">
                    <span className="font-black text-white">Intentos por ronda</span>
                    <input
                      required
                      min={1}
                      type="number"
                      name="attemptsPerRound"
                      value={settingsForm.attemptsPerRound}
                      onChange={onSettingsChange}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-base text-white outline-none transition focus:border-brand-300"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2 text-base text-slate-300">
                    <span className="font-black text-white">Temporizador</span>
                    <select
                      name="pvpTimerSeconds"
                      value={settingsForm.mode === 'pvp' ? settingsForm.pvpTimerSeconds : ''}
                      onChange={onSettingsChange}
                      disabled={settingsForm.mode !== 'pvp'}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-base text-white outline-none transition focus:border-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Sin temporizador</option>
                      <option value="60">60 segundos</option>
                      <option value="90">90 segundos</option>
                      <option value="120">120 segundos</option>
                      <option value="180">180 segundos</option>
                    </select>
                  </label>

                  <label className="block space-y-2 text-base text-slate-300">
                    <span className="font-black text-white">Máximo de jugadores</span>
                    <input
                      min={settingsForm.mode === 'pvp' ? 2 : 1}
                      type="number"
                      name="maxPlayers"
                      value={settingsForm.maxPlayers}
                      onChange={onSettingsChange}
                      placeholder="Sin límite"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-brand-300"
                    />
                  </label>
                </div>

                <label className="block space-y-2 text-base text-slate-300">
                  <span className="font-black text-white">Longitud máxima de palabra</span>
                  <select
                    name="maxWordLength"
                    value={settingsForm.maxWordLength}
                    onChange={onSettingsChange}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-base text-white outline-none transition focus:border-brand-300"
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

                {settingsError ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/12 px-4 py-3 text-base text-rose-100">{settingsError}</p> : null}

                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="w-full rounded-full bg-emerald-500 px-5 py-4 text-lg font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:w-auto"
                >
                  {isSavingSettings ? 'Guardando...' : '💾 Guardar cambios'}
                </button>
              </form>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {statCard('🎲', 'Modo', formatMode(room.settings.mode))}
                {statCard('⚡', 'Envío', formatSubmissionMode(room.settings.submissionMode))}
                {statCard('🏁', 'Rondas', String(room.settings.totalRounds))}
                {statCard('🎯', 'Intentos', String(room.settings.attemptsPerRound))}
                {statCard('⏱️', 'Temporizador', formatTimer(room.settings.pvpTimerSeconds))}
                {statCard('👥', 'Máx. jugadores', room.settings.maxPlayers ? String(room.settings.maxPlayers) : 'Sin límite')}
                {statCard('🔠', 'Largo máx.', room.settings.maxWordLength ? String(room.settings.maxWordLength) : 'Cualquiera')}
              </div>
            )}
          </RoomPanel>
        </div>

        <RoomChatDock
          title="💬 Chat de la sala"
          messages={room.chatMessages ?? []}
          draft={chatDraft}
          onDraftChange={onChatDraftChange}
          onSend={onSendChat}
          isSending={isSendingChat}
          mobileOpen={isMobileChatOpen}
          onMobileOpenChange={onChatOpenChange}
          unreadCount={unreadCount}
        />
      </div>
    </div>
  )
}
