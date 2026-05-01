interface LandingActionButtonProps {
  title: string
  description: string
  icon: string
  active: boolean
  accent: 'brand' | 'emerald'
  onClick: () => void
}

const accentClasses: Record<LandingActionButtonProps['accent'], { active: string, icon: string }> = {
  brand: {
    active: 'border-brand-300/70 bg-brand-400/18 text-white shadow-[0_18px_40px_rgba(39,177,255,0.22)]',
    icon: 'bg-brand-300/20 text-brand-100',
  },
  emerald: {
    active: 'border-emerald-300/70 bg-emerald-400/16 text-white shadow-[0_18px_40px_rgba(16,185,129,0.22)]',
    icon: 'bg-emerald-300/20 text-emerald-100',
  },
}

export function LandingActionButton({ title, description, icon, active, accent, onClick }: LandingActionButtonProps) {
  const palette = accentClasses[accent]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-start gap-4 rounded-[28px] border px-5 py-5 text-left transition sm:px-6 ${active ? palette.active : 'border-white/10 bg-slate-900/82 text-slate-100 hover:border-white/20 hover:bg-white/10'}`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black ${active ? palette.icon : 'bg-white/10 text-white'}`}>
        {icon}
      </span>
      <span className="space-y-1.5">
        <span className="block text-lg font-semibold">{title}</span>
        <span className="block text-sm leading-6 text-slate-300">{description}</span>
      </span>
    </button>
  )
}
