'use client'

import { useEffect, useRef, useState } from 'react'
import { type ChatMessage, type GlobalChatMessage, QUICK_TAUNTS } from './types'
import { audio } from '@/lib/ecard/audio'

type Tab = 'room' | 'global'

interface ChatDockProps {
  /** Local match log: your lines, Hyodo's taunts, system notices, real opponent chat. */
  roomMessages: ChatMessage[]
  /** Same real, shared world-chat feed shown live in the lobby. */
  worldMessages: GlobalChatMessage[]
  roomCode?: string
  onSendRoom: (text: string) => void
  onSendWorld: (text: string) => void
  onQuickTaunt: (text: string) => void
  onFocusChange: (active: boolean) => void
  wsConnected?: boolean
}

export function ChatDock({
  roomMessages,
  worldMessages,
  roomCode,
  onSendRoom,
  onSendWorld,
  onQuickTaunt,
  onFocusChange,
  wsConnected,
}: ChatDockProps) {
  const [expanded, setExpanded] = useState(true)
  const [tab, setTab] = useState<Tab>('room')
  const [draft, setDraft] = useState('')
  const [unread, setUnread] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const prevLen = useRef(roomMessages.length + worldMessages.length)

  const visible: Array<{ id: string; text: string; label?: string; color?: string; align: 'you' | 'other' | 'system' }> =
    tab === 'room'
      ? roomMessages.map((m) => ({
          id: m.id,
          text: m.text,
          label: m.sender === 'you' ? 'You' : m.sender === 'hyodo' ? 'Hyodo' : m.sender === 'opponent' ? m.name || 'Đối Thủ' : undefined,
          align: m.sender === 'you' ? 'you' : m.sender === 'system' ? 'system' : 'other',
        }))
      : worldMessages.map((m) => ({
          id: m.id,
          text: m.text,
          label: m.name,
          color: m.color,
          align: m.self ? 'you' : 'other',
        }))

  useEffect(() => {
    const total = roomMessages.length + worldMessages.length
    if (total > prevLen.current && !expanded) {
      setUnread((u) => u + (total - prevLen.current))
    }
    prevLen.current = total
  }, [roomMessages.length, worldMessages.length, expanded])

  useEffect(() => {
    if (expanded && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [visible.length, expanded, tab])

  function submit() {
    const t = draft.trim()
    if (!t) return
    audio.click()
    if (tab === 'room') onSendRoom(t)
    else onSendWorld(t)
    setDraft('')
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => {
          audio.click()
          setExpanded(true)
          setUnread(0)
        }}
        className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 rounded-full border border-gold/50 bg-obsidian px-4 py-2 shadow-xl"
        aria-label="Expand chat"
      >
        <span className="font-display text-sm tracking-wider text-gold">▲ CHAT</span>
        {unread > 0 && (
          <span className="relative flex h-5 w-5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-600 opacity-75" />
            <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          </span>
        )}
      </button>
    )
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-[9999] flex flex-col rounded-lg border border-gold/40 bg-obsidian/95 shadow-2xl backdrop-blur"
      style={{ width: 380, maxWidth: 'calc(100vw - 2.5rem)' }}
    >
      {/* header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab('room')}
            className={`rounded px-2 py-1 font-sans text-xs uppercase tracking-wider ${
              tab === 'room' ? 'bg-blood/20 text-blood' : 'text-muted-foreground'
            }`}
          >
            Room {roomCode ? `· ${roomCode}` : ''}
          </button>
          <button
            type="button"
            onClick={() => setTab('global')}
            className={`rounded px-2 py-1 font-sans text-xs uppercase tracking-wider ${
              tab === 'global' ? 'bg-gold/15 text-gold' : 'text-muted-foreground'
            }`}
          >
            Global {wsConnected ? '' : '(offline)'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="px-1 font-display text-lg text-muted-foreground hover:text-foreground"
          aria-label="Minimize chat"
        >
          ▼
        </button>
      </div>

      {/* messages */}
      <div ref={listRef} className="thin-scroll flex h-52 flex-col gap-2 overflow-y-auto px-3 py-2">
        {visible.length === 0 && (
          <p className="mt-4 text-center font-sans text-xs text-muted-foreground">
            {tab === 'room' && !roomCode ? 'No active room.' : 'Silence... for now.'}
          </p>
        )}
        {visible.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-md px-2.5 py-1.5 font-sans text-sm ${
              m.align === 'you'
                ? 'self-end bg-gold/15 text-foreground'
                : m.align === 'other'
                  ? 'self-start border border-blood/40 bg-blood/10 text-foreground'
                  : 'self-center bg-muted/60 text-muted-foreground text-xs'
            }`}
          >
            {m.align !== 'system' && m.label && (
              <span
                className="mr-1 font-display text-[11px] uppercase tracking-wide"
                style={{ color: m.color ?? (m.align === 'you' ? 'var(--gold)' : 'var(--blood)') }}
              >
                {m.label}:
              </span>
            )}
            {m.text}
          </div>
        ))}
      </div>

      {/* quick taunts (room only) */}
      {tab === 'room' && (
        <div className="flex flex-wrap gap-1 border-t border-border px-2 py-2">
          {QUICK_TAUNTS.map((t) => (
            <button
              key={t.en}
              type="button"
              onClick={() => {
                audio.select()
                onQuickTaunt(t.vi)
              }}
              title={t.en}
              className="rounded border border-border bg-background/50 px-2 py-1 font-sans text-[11px] text-muted-foreground transition-colors hover:border-blood/50 hover:text-foreground"
            >
              {t.vi}
            </button>
          ))}
        </div>
      )}

      {/* input */}
      <div className="flex gap-2 border-t border-border p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) submit()
          }}
          placeholder="Speak, before the silence..."
          className="flex-1 rounded-md border border-input bg-background/60 px-2.5 py-1.5 font-sans text-sm text-foreground outline-none focus:border-gold"
        />
        <button
          type="button"
          onClick={submit}
          className="rounded-md border border-gold/50 px-3 font-sans text-sm text-gold hover:bg-gold/10"
        >
          Send
        </button>
      </div>
    </div>
  )
}
