import { Link, useParams } from 'react-router-dom'
import { SectionCard } from '../components/ui/SectionCard'

const lobbyItems = [
  'Room code and copy/share action',
  'Player list with host badge',
  'Room settings summary',
  'Start restrictions by mode',
  'Lobby chat visible',
]

const gameItems = [
  'Letter-box-based guess entry',
  'Auto-send or manual submit indicator',
  'PVP timer only when enabled',
  'Co-op shared attempts vs PVP personal attempts',
  'In-game chat visible',
]

const resultsItems = [
  'Round summary with host continue action',
  'Automatic summary advance after ~60 seconds',
  'Final results remain inside the room flow',
]

export function RoomPage() {
  const { code = 'UNKNOWN' } = useParams()

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/85 p-8 shadow-glow lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-brand-200">Room preview</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Room {code}</h2>
          <p className="mt-3 max-w-2xl text-slate-300">Single-route placeholder for the lobby, active round, summary, and final results states described in the Phase 0 documents.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">Mode-aware start rules</span>
          <span className="rounded-full border border-brand-400/30 bg-brand-400/10 px-4 py-2 text-sm text-brand-200">Auto-send default</span>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="Lobby state" description="What the room route must render before the match starts.">
          <ul className="space-y-3 text-sm text-slate-300">
            {lobbyItems.map((item) => (
              <li key={item} className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">{item}</li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Game state" description="What will later become the active round screen.">
          <ul className="space-y-3 text-sm text-slate-300">
            {gameItems.map((item) => (
              <li key={item} className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">{item}</li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Summary and results" description="Post-round and post-match placeholders.">
          <ul className="space-y-3 text-sm text-slate-300">
            {resultsItems.map((item) => (
              <li key={item} className="rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3">{item}</li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
        <span>Routing is ready for placeholder verification.</span>
        <Link className="rounded-full border border-white/10 px-4 py-2 transition hover:border-brand-400 hover:text-white" to="/">
          Back to landing page
        </Link>
      </div>
    </div>
  )
}
