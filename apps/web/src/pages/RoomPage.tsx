import { Link, useParams } from 'react-router-dom'
import { SectionCard } from '../components/ui/SectionCard'

const lobbyItems = [
  'Código de sala con acción para copiar o compartir',
  'Lista de jugadores con distintivo de anfitrión',
  'Resumen de la configuración de la sala',
  'Restricciones de inicio según el modo',
  'Chat visible en la sala de espera',
]

const gameItems = [
  'Ingreso de palabras mediante casillas por letra',
  'Indicador de autoenvío o envío manual',
  'Temporizador PVP solo cuando esté activado',
  'Intentos compartidos en cooperativo frente a intentos personales en PVP',
  'Chat visible durante la partida',
]

const resultsItems = [
  'Resumen de ronda con acción del anfitrión para continuar',
  'Avance automático del resumen después de ~60 segundos',
  'Resultados finales dentro del flujo de la sala',
]

export function RoomPage() {
  const { code = 'DESCONOCIDA' } = useParams()

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/85 p-8 shadow-glow lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Vista previa de sala</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Sala {code}</h2>
          <p className="mt-3 max-w-2xl text-slate-300">Vista provisional de ruta única para la sala de espera, la ronda activa, el resumen y los resultados finales descritos en los documentos de la fase 0.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">Reglas de inicio según el modo</span>
          <span className="rounded-full border border-brand-400/30 bg-brand-400/10 px-4 py-2 text-sm text-brand-200">Autoenvío por defecto</span>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="Estado de sala de espera" description="Lo que la ruta de sala debe mostrar antes de que empiece la partida.">
          <ul className="space-y-3 text-sm text-slate-300">
            {lobbyItems.map((item) => (
              <li key={item} className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">{item}</li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Estado de juego" description="Lo que más adelante será la pantalla de ronda activa.">
          <ul className="space-y-3 text-sm text-slate-300">
            {gameItems.map((item) => (
              <li key={item} className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">{item}</li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Resumen y resultados" description="Contenido provisional posterior a la ronda y a la partida.">
          <ul className="space-y-3 text-sm text-slate-300">
            {resultsItems.map((item) => (
              <li key={item} className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
        <span>Las rutas están listas para la verificación inicial.</span>
        <Link className="rounded-full border border-white/10 px-4 py-2 transition hover:border-brand-400 hover:text-white" to="/">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
