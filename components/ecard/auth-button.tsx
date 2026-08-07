'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/firebase/auth-context'
import { audio } from '@/lib/ecard/audio'

/** Mounted in the lobby header. Renders nothing if Firebase isn't configured yet. */
export function AuthButton() {
  const { user, loading, configured, signInWithGoogle, signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  if (!configured) return null

  if (loading) {
    return <span className="font-sans text-[10px] uppercase tracking-widest text-zinc-600">Đang kết nối…</span>
  }

  if (user) {
    return (
      <button
        type="button"
        title={user.email ?? undefined}
        disabled={busy}
        onClick={async () => {
          audio.click?.()
          setBusy(true)
          try {
            await signOut()
          } finally {
            setBusy(false)
          }
        }}
        className="rounded border border-zinc-700 bg-black/40 px-3 py-1.5 font-sans text-[10px] uppercase tracking-[0.25em] text-zinc-400 transition-colors hover:border-[#b3914a]/50 hover:text-[#b3914a] disabled:opacity-50"
      >
        ☁ {user.displayName ?? user.email ?? 'Đã Đồng Bộ'} · Đăng Xuất
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        audio.click?.()
        setBusy(true)
        try {
          await signInWithGoogle()
        } finally {
          setBusy(false)
        }
      }}
      className="rounded border border-zinc-700 bg-black/40 px-3 py-1.5 font-sans text-[10px] uppercase tracking-[0.25em] text-zinc-400 transition-colors hover:border-[#b3914a]/50 hover:text-[#b3914a] disabled:opacity-50"
    >
      {busy ? 'Đang Kết Nối…' : '☁ Đăng Nhập Google Để Lưu Tiến Trình'}
    </button>
  )
}
