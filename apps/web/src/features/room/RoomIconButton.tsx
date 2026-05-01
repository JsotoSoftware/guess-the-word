import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface RoomIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  tone?: 'default' | 'danger' | 'warning' | 'accent'
  icon: ReactNode
}

const toneClasses: Record<NonNullable<RoomIconButtonProps['tone']>, string> = {
  default: 'border-white/10 bg-white/10 text-white hover:border-white/20 hover:bg-white/15',
  danger: 'border-rose-300/30 bg-rose-500/12 text-rose-100 hover:border-rose-200/40 hover:bg-rose-500/18',
  warning: 'border-amber-300/30 bg-amber-500/12 text-amber-100 hover:border-amber-200/40 hover:bg-amber-500/18',
  accent: 'border-brand-300/40 bg-brand-400/16 text-brand-100 hover:border-brand-200/50 hover:bg-brand-400/22',
}

export function RoomIconButton({ label, tone = 'default', icon, className = '', ...props }: RoomIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClasses[tone]} ${className}`}
      {...props}
    >
      <span aria-hidden="true" className="h-5 w-5">{icon}</span>
      <span className="sr-only">{label}</span>
    </button>
  )
}
