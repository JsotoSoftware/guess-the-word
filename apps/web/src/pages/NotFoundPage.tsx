import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-white/10 bg-slate-900/85 p-10 text-center shadow-glow">
      <p className="text-sm uppercase tracking-[0.3em] text-brand-200">404</p>
      <h2 className="mt-3 text-3xl font-bold text-white">Ruta no encontrada</h2>
      <p className="mt-4 text-slate-300">La pantalla que buscas no está disponible o ya no existe.</p>
      <Link className="mt-6 rounded-full bg-brand-500 px-5 py-3 font-medium text-white transition hover:bg-brand-400" to="/">
        Volver al inicio
      </Link>
    </div>
  )
}
