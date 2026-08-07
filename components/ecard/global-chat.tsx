'use client'

import { useEffect, useRef, useState } from 'react'
import type { GlobalChatMessage } from './types'
import { audio } from '@/lib/ecard/audio'

interface GlobalChatProps {
  playerName: string
  /** Real, shared feed passed down from the game — no local mock state. */
  messages: GlobalChatMessage[]
  onSend: (text: string) => void
  connected?: boolean
}

const MAX_LEN = 60
const COOLDOWN_MS = 3000

/**
 * RIGHT COLUMN (Global Chat Hub):
 * Styled as an industrial dark steel terminal box. Fully controlled —
 * messages come from the real WebSocket-synced feed, not local mock bots.
 */
export function GlobalChat({ playerName, messages, onSend, connected }: GlobalChatProps) {
  const [draft, setDraft] = useState('')
  const [warning, setWarning] = useState(false)
  const lastMessageTimestamp = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length])

  function submit() {
    const text = draft.trim().slice(0, MAX_LEN)
    if (!text) return

    const now = Date.now()
    if (now - lastMessageTimestamp.current < COOLDOWN_MS) {
      setWarning(true)
      audio.lose?.()
      setTimeout(() => setWarning(false), 2000)
      return
    }

    lastMessageTimestamp.current = now
    audio.click?.()
    onSend(text)
    setDraft('')
  }

  return (
    <div
      className="bg-[#0c0907] border border-zinc-800 h-[260px] flex flex-col rounded overflow-hidden"
      style={{
        boxShadow:
          '0 10px 30px -5px rgba(0,0,0,0.9), 0 20px 60px -10px rgba(0,0,0,0.95), inset 0 1px 0 0 rgba(255,255,255,0.03)',
      }}
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 bg-[#121212]">
        <h3 className="font-display text-sm uppercase tracking-[0.2em] text-gold">Cổng Chat Thế Giới / Global World Chat</h3>
        <span
          className={`flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-widest ${
            connected ? 'text-emerald-400' : 'text-zinc-600'
          }`}
        >
          <span className="relative flex h-2 w-2">
            {connected && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
          </span>
          {connected ? 'HUB ACTIVE' : 'CONNECTING...'}
        </span>
      </div>

      <div ref={listRef} className="thin-scroll flex-1 space-y-1.5 overflow-y-auto px-3 py-2 font-sans text-sm">
        {messages.length === 0 && (
          <p className="mt-4 text-center font-sans text-xs text-zinc-600 italic">Chưa có ai lên tiếng...</p>
        )}
        {messages.map((m) => (
          <p key={m.id} className="leading-snug border-l-2 border-transparent hover:border-zinc-700 pl-1 transition-colors">
            <span className="font-bold" style={{ color: m.color }}>
              {m?.name ?? 'Ẩn Danh'}:
            </span>{' '}
            <span className="text-zinc-300">{m?.text}</span>
          </p>
        ))}
      </div>

      <div className="relative border-t border-zinc-800 p-2 bg-[#0a0a0a]">
        {warning && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] px-2 py-1 rounded-full font-bold animate-bounce shadow-lg border border-red-400 z-20">
            ⚠️ SPAM DETECTION: Vui lòng đợi 3 giây!
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_LEN}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder="Nhập nội dung chat..."
            className={`flex-1 rounded border bg-[#050505] px-3 py-1.5 font-sans text-sm text-zinc-200 outline-none transition-all duration-300 ${
              warning ? 'border-red-600 ring-1 ring-red-600 animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'border-zinc-800 focus:border-gold/50'
            }`}
          />
          <button
            type="button"
            onClick={submit}
            className="rounded border border-gold/40 bg-gold/5 px-4 py-1.5 font-sans text-xs font-bold uppercase tracking-widest text-gold hover:bg-gold/20 transition-colors"
          >
            Gửi
          </button>
        </div>
        <div className="flex justify-between mt-1 px-1">
          <span className="text-[9px] text-zinc-600 uppercase tracking-tighter">Terminal v2.0.4</span>
          <span className={`text-[9px] font-mono ${draft.length >= MAX_LEN ? 'text-red-500' : 'text-zinc-600'}`}>
            {draft.length}/{MAX_LEN}
          </span>
        </div>
      </div>
    </div>
  )
}
