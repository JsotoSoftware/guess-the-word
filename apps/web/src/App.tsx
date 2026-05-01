import { Link, Route, Routes } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { RoomPage } from './pages/RoomPage'
import { MockGamePage } from './pages/MockGamePage'
import { AdminWordsPage } from './pages/AdminWordsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { env } from './lib/env'
import { useRoomSession } from './contexts/room-session'

export default function App() {
  const { room, connected } = useRoomSession()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-brand-300">Adivina la Palabra</p>
            <h1 className="text-lg font-semibold text-white">Lobby multijugador · fase 3.1</h1>
          </div>
          <nav className="flex items-center gap-3 text-sm text-slate-300">
            <Link className="rounded-full border border-white/10 px-4 py-2 transition hover:border-brand-400 hover:text-white" to="/">
              Inicio
            </Link>
            {room ? (
              <Link className="rounded-full border border-white/10 px-4 py-2 transition hover:border-brand-400 hover:text-white" to={`/room/${room.roomCode}`}>
                Mi sala
              </Link>
            ) : null}
            <Link className="rounded-full border border-white/10 px-4 py-2 transition hover:border-brand-400 hover:text-white" to="/demo/tablero">
              Tablero demo
            </Link>
            <Link className="rounded-full border border-white/10 px-4 py-2 transition hover:border-brand-400 hover:text-white" to="/admin/words">
              Admin palabras
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/room/:code" element={<RoomPage />} />
          <Route path="/demo/tablero" element={<MockGamePage />} />
          <Route path="/admin/words" element={<AdminWordsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="border-t border-white/10 bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <span>{connected ? 'Socket conectado y listo para crear/unirse a salas.' : 'Intentando conectar el frontend con el backend...'}</span>
          <div className="flex flex-col gap-1 md:items-end">
            <span>API: {env.apiUrl}</span>
            <span>Socket: {env.socketUrl}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
