import type { ReactNode } from 'react'

function icon(paths: ReactNode) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      {paths}
    </svg>
  )
}

export const copyIcon = icon(
  <>
    <rect x="9" y="9" width="10" height="10" rx="2" />
    <path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
  </>,
)

export const closeIcon = icon(<path d="M6 6l12 12M18 6L6 18" />)

export const exitIcon = icon(
  <>
    <path d="M10 17l-5-5 5-5" />
    <path d="M5 12h10" />
    <path d="M14 5h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3" />
  </>,
)
