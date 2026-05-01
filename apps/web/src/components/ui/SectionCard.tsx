import type { ReactNode } from 'react'

interface SectionCardProps {
  title: string
  description?: string
  children: ReactNode
}

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-glow">
      <div className="mb-5 space-y-2">
        <h2 className="text-2xl font-black tracking-tight text-white sm:text-[1.75rem]">{title}</h2>
        {description ? <p className="text-base leading-7 text-slate-300">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}
