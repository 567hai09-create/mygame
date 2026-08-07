'use client'

import { useEffect, useRef } from 'react'
import type { Faction } from '@/lib/ecard/game'

function HpBar({ label, hp, faction, hit }: { label: string; hp: number; faction: Faction; hit?: boolean }) {
  const color = faction === 'KING' ? 'var(--gold)' : 'var(--blood)'
  return (
    <div className="min-w-[120px] flex-1">
      <div className="flex items-center justify-between font-sans text-xs uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span style={{ color }}>{Math.max(0, hp)} HP</span>
      </div>
      {/* Single brief red pulse right on the bar when HP is lost — no repeat, no strobe */}
      <div
        className={`mt-1 h-2.5 w-full overflow-hidden rounded-full border bg-background/70 ${hit ? 'hp-hit-pulse' : 'border-border'}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, hp))}%`, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
    </div>
  )
}

function HeartMonitor({ bpm }: { bpm: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d')
    if (!ctx) return
    const g: CanvasRenderingContext2D = ctx
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = 160
    const H = 44
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    let x = 0
    const points: number[] = new Array(W).fill(H / 2)

    function step() {
      const bpmNow = bpmRef.current ?? 70
      const speed = 1 + (bpmNow - 70) / 45 // faster line at higher BPM
      // ECG-ish spike pattern tied to a moving phase
      const phase = (x % Math.max(24, 120 - bpmNow * 0.4)) / Math.max(24, 120 - bpmNow * 0.4)
      let y = H / 2
      if (phase > 0.44 && phase < 0.5) y = H / 2 - 16
      else if (phase >= 0.5 && phase < 0.56) y = H / 2 + 14
      else y = H / 2 + (Math.random() - 0.5) * 2
      points.push(y)
      points.shift()
      x += speed

      g.clearRect(0, 0, W, H)
      const danger = bpmNow > 120
      g.strokeStyle = danger ? '#ff3b3b' : 'var(--blood)'
      g.lineWidth = 1.6
      g.shadowColor = danger ? '#ff0000' : 'transparent'
      g.shadowBlur = danger ? 6 : 0
      g.beginPath()
      points.forEach((py, i) => {
        if (i === 0) g.moveTo(0, py)
        else g.lineTo(i, py)
      })
      g.stroke()
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const danger = bpm > 120
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-2 py-1">
      <canvas ref={canvasRef} style={{ width: 160, height: 44 }} aria-hidden="true" />
      <span
        className={`font-display text-lg tabular-nums ${danger ? 'text-[#ff3b3b]' : 'text-blood'}`}
        aria-label={`Heart rate ${Math.round(bpm)} beats per minute`}
      >
        {Math.round(bpm)}
        <span className="ml-0.5 font-sans text-[10px] uppercase">bpm</span>
      </span>
    </div>
  )
}

interface HudProps {
  round: number
  faction: Faction
  playerHP: number
  enemyHP: number
  playerWins: number
  enemyWins: number
  timeLeft: number
  bpm: number
  drillProgress: number
  playerHit?: boolean
  enemyHit?: boolean
}

export function Hud({
  round,
  faction,
  playerHP,
  enemyHP,
  playerWins,
  enemyWins,
  timeLeft,
  bpm,
  drillProgress,
  playerHit,
  enemyHit,
}: HudProps) {
  const urgent = timeLeft <= 20
  return (
    <div className="deep-panel flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/70 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">Round</div>
          <div className="font-display text-2xl leading-none text-gold">{round}/12</div>
        </div>
        <div className="text-center">
          <div className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">Faction</div>
          <div
            className="font-display text-lg leading-none"
            style={{ color: faction === 'KING' ? 'var(--gold)' : 'var(--blood)' }}
          >
            {faction === 'KING' ? 'Emperor' : 'Slave'}
          </div>
        </div>
        <div className="text-center">
          <div className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">Score</div>
          <div className="font-display text-lg leading-none text-foreground">
            {playerWins}–{enemyWins}
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center gap-3 md:justify-center">
        <HpBar label="You" hp={playerHP} faction={faction} hit={playerHit} />
        <HpBar label="Hyodo" hp={enemyHP} faction={faction === 'KING' ? 'SLAVE' : 'KING'} hit={enemyHit} />
      </div>

      <div className="flex items-center gap-3">
        <HeartMonitor bpm={bpm} />
        <div className="text-center">
          <div className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">Timer</div>
          <div
            className={`font-display text-3xl leading-none tabular-nums ${
              urgent ? 'animate-pulse text-[#ff3b3b]' : 'text-foreground'
            }`}
          >
            {String(Math.max(0, timeLeft)).padStart(2, '0')}
          </div>
        </div>
        {drillProgress > 0 && (
          <div className="text-center" aria-label={`Drill depth ${drillProgress} of 5`}>
            <div className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">Drill</div>
            <div className="font-display text-xl leading-none text-[#ff3b3b]">{drillProgress}/5</div>
          </div>
        )}
      </div>
    </div>
  )
}
