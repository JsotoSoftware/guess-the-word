import type { ReactNode } from 'react'

interface RoomStageHeaderProps {
  badge: string
  title: string
  subtitle: string
  actions?: ReactNode
}

export function RoomStageHeader({ badge, title, subtitle, actions }: RoomStageHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/88 p-5 shadow-glow sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(39,177,255,0.18),transparent_32%)]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-brand-300/30 bg-brand-400/12 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-brand-100">
            {badge}
          </span>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-[2.65rem]">{title}</h1>
            <p className="mt-2 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">{subtitle}</p>
          </div>
        </div>

        {actions ? <div className="flex items-center gap-3 self-start">{actions}</div> : null}
      </div>
    </section>
  )
}
