import { Link } from 'react-router-dom'
import { SectionCard } from '../components/ui/SectionCard'

const createRoomFields = [
  'Apodo',
  'Modo: PVP o Cooperativo',
  'Rondas',
  'Intentos por ronda',
  'Temporizador opcional para PVP',
  'Modo de envío: autoenvío o envío manual',
]

const joinRoomFields = ['Código de sala', 'Apodo']

export function LandingPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-brand-400/20 bg-gradient-to-br from-brand-500/10 via-slate-900 to-slate-950 p-8 shadow-glow">
        <span className="inline-flex rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-brand-200">
          Fase 1.2
        </span>
        <h2 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight text-white">Base inicial del frontend para el juego de palabras en tiempo real.</h2>
        <p className="mt-4 max-w-3xl text-base text-slate-300">
          Esta interfaz provisional confirma la configuración de Vite, React, TypeScript, Tailwind, rutas y variables de entorno antes de implementar la experiencia real del juego.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-full bg-brand-500 px-5 py-3 font-medium text-white transition hover:bg-brand-400" to="/room/ABCD12">
            Ver ruta de sala
          </Link>
          <a className="rounded-full border border-white/10 px-5 py-3 font-medium text-slate-200 transition hover:border-white/30 hover:text-white" href="#flows">
            Revisar flujos provisionales
          </a>
        </div>
      </section>

      <div id="flows" className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Flujo para crear sala" description="Contenido provisional orientado al anfitrión para la pantalla de creación de sala.">
          <ul className="space-y-3 text-sm text-slate-300">
            {createRoomFields.map((field) => (
              <li key={field} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-500/15 text-xs font-semibold text-brand-200">
                  •
                </span>
                <span>{field}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Flujo para unirse a una sala" description="Contenido provisional orientado al jugador para entrar a una sala existente.">
          <ul className="space-y-3 text-sm text-slate-300">
            {joinRoomFields.map((field) => (
              <li key={field} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-semibold text-emerald-200">
                  •
                </span>
                <span>{field}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-slate-400">Validaciones futuras: código inválido, sala llena, sala cerrada y conflictos de apodo.</p>
        </SectionCard>
      </div>
    </div>
  )
}
