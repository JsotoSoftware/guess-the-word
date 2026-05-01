import type { ReactNode } from 'react'

interface RoomPanelProps {
  title: string
  description?: string
  children: ReactNode
}

export function RoomPanel({ title, description, children }: RoomPanelProps) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-slate-900/88 p-5 shadow-glow sm:p-6">
      <div className="mb-5 space-y-2">
        <h2 className="text-2xl font-black tracking-tight text-white sm:text-[1.7rem]">{title}</h2>
        {description ? <p className="text-base leading-7 text-slate-300">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}
