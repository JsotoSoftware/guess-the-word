import type { ReactNode } from 'react'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#1b1d6b] text-slate-100">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(81,201,255,0.22),_transparent_32%),linear-gradient(180deg,_#1b1d6b_0%,_#10164f_45%,_#0b1138_100%)]">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-3 pb-8 pt-4 sm:px-6 lg:px-8">
          <header className="py-3 sm:py-5">
            <div className="mx-auto flex max-w-5xl justify-center">
              <div className="rounded-full border border-white/12 bg-white/10 px-4 py-2 text-center text-sm font-semibold uppercase tracking-[0.24em] text-white shadow-glow sm:px-5">
                Adivina la palabra
              </div>
            </div>
          </header>

          <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col">{children}</main>
        </div>
      </div>
    </div>
  )
}
