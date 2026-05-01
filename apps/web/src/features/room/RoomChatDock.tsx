import type { ChatMessage } from '@guess-the-word/shared'
import { useEffect, useRef, type FormEvent } from 'react'

interface RoomChatDockProps {
  title: string
  messages: ChatMessage[]
  draft: string
  onDraftChange: (value: string) => void
  onSend: (event: FormEvent<HTMLFormElement>) => void
  isSending: boolean
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
  unreadCount: number
}

export function RoomChatDock({
  title,
  messages,
  draft,
  onDraftChange,
  onSend,
  isSending,
  mobileOpen,
  onMobileOpenChange,
  unreadCount,
}: RoomChatDockProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = scrollContainerRef.current

    if (!container) {
      return
    }

    container.scrollTop = container.scrollHeight
  }, [messages.length, mobileOpen])

  const chatContent = (
    <div className="flex h-full flex-col rounded-[30px] border border-white/10 bg-slate-900/92 p-4 shadow-glow sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
          <p className="text-base text-slate-300">Mensajes rápidos del equipo.</p>
        </div>
        <button
          type="button"
          onClick={() => onMobileOpenChange(false)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white lg:hidden"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-hidden rounded-[24px] border border-white/8 bg-slate-950/65">
        <div ref={scrollContainerRef} className="flex h-full flex-col gap-3 overflow-y-auto p-4">
          {messages.length > 0 ? (
            messages.map((message) => (
              <article key={message.messageId} className="rounded-2xl border border-white/6 bg-white/5 px-3 py-3 text-base text-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{message.senderNickname}</p>
                  <p className="text-xs text-slate-400">{new Date(message.sentAt).toLocaleTimeString()}</p>
                </div>
                <p className="mt-1.5 leading-6 text-slate-300">{message.text}</p>
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-white/8 bg-white/5 px-4 py-6 text-center text-base text-slate-400">
              Todavía no hay mensajes.
            </p>
          )}
        </div>
      </div>

      <form className="mt-4 flex gap-3" onSubmit={onSend}>
        <input
          type="text"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Escribe un mensaje"
          maxLength={300}
          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-brand-300"
        />
        <button
          type="submit"
          disabled={isSending || !draft.trim()}
          className="rounded-2xl bg-brand-500 px-4 py-3 text-base font-black text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {isSending ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </div>
  )

  return (
    <>
      <aside className="hidden lg:block lg:min-w-[320px] lg:max-w-[360px] lg:flex-1">{chatContent}</aside>

      <button
        type="button"
        onClick={() => onMobileOpenChange(true)}
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(39,177,255,0.35)] transition hover:bg-brand-400 lg:hidden"
      >
        <span>💬 Chat</span>
        {unreadCount > 0 ? (
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-white px-2 py-0.5 text-xs font-bold text-brand-700">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 flex items-end bg-slate-950/70 backdrop-blur-sm lg:hidden">
          <div className="h-[78vh] w-full rounded-t-[32px] border border-white/10 bg-transparent p-3">{chatContent}</div>
        </div>
      ) : null}
    </>
  )
}
