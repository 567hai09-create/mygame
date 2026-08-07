'use client'

import { useEffect, useRef } from 'react'
import { audio } from '@/lib/ecard/audio'

interface DungeonLockProps {
  secondsLeft: number
}

/** Full-screen inescapable iron-bar prison overlay for PvP surrender penalty. */
export function DungeonLock({ secondsLeft }: DungeonLockProps) {
  const rungOnce = useRef(false)
  useEffect(() => {
    if (rungOnce.current) return
    rungOnce.current = true
    audio.ensure?.()
    audio.deathBell?.()
  }, [])

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')
  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center"
      style={{ background: 'rgba(3,2,2,0.94)' }}
      role="alertdialog"
      aria-label="Dungeon lockout in progress"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* iron bars */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, #111 0 14px, transparent 14px 82px), repeating-linear-gradient(90deg, rgba(120,120,130,0.25) 0 2px, transparent 2px 14px)',
          boxShadow: 'inset 0 0 120px rgba(0,0,0,0.9)',
        }}
      />
      {/* horizontal crossbars */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/4 h-3 bg-[#0d0d0f]"
        style={{ boxShadow: '0 0 10px #000' }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-1/4 h-3 bg-[#0d0d0f]"
        style={{ boxShadow: '0 0 10px #000' }}
      />

      <div className="relative z-10 text-center">
        <p className="font-sans text-sm uppercase tracking-[0.4em] text-blood">Iron Prison</p>
        <h2 className="mt-2 font-display text-4xl font-black tracking-widest text-foreground md:text-5xl">
          ĐẦU HÀNG VÔ ĐIỀU KIỆN
        </h2>
        <p className="mt-3 max-w-md text-balance font-sans text-muted-foreground">
          You forfeited. The dungeon holds those who flee. −100 PRD stripped from your rank. There is no
          F5 escape from the bars.
        </p>
        <div className="mt-6 font-display text-7xl tabular-nums text-[#ff3b3b]" aria-live="polite">
          {mm}:{ss}
        </div>
      </div>
    </div>
  )
}
