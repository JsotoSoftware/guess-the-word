import type { ReactNode } from 'react'

interface LandingPanelProps {
  title: string
  description: string
  children: ReactNode
}

export function LandingPanel({ title, description, children }: LandingPanelProps) {
  return (
    <section className="rounded-[32px] border border-white/10 bg-slate-900/88 p-5 shadow-glow sm:p-6">
      <div className="mb-5 space-y-2">
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <p className="text-sm leading-6 text-slate-300">{description}</p>
      </div>
      {children}
    </section>
  )
}
