'use client'

import { useEffect, useRef } from 'react'

interface ExecutionOverlayProps {
  active: boolean
  /** normalized origin of the shatter, 0-1 */
  originX?: number
  originY?: number
  onComplete?: () => void
}

interface Shard {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  size: number
  life: number
  color: string
  drag: number
}

/**
 * High-intensity "fatal breach" finisher: 500+ micro-particles blast outward
 * from the strike point at extreme velocity with per-particle fluid drag, and
 * permanent dark-red smudge pools paint the screen boundaries. Terminates its
 * RAF loop after 4s to preserve 60fps.
 */
export function ExecutionOverlay({ active, originX = 0.5, originY = 0.5, onComplete }: ExecutionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const doneRef = useRef(onComplete)
  doneRef.current = onComplete

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = window.innerWidth
    const H = window.innerHeight
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const ox = originX * W
    const oy = originY * H
    const palette = ['#500000', '#7a0d0d', '#9e2a2b', '#c0392b', '#2a0505']

    const shards: Shard[] = []
    for (let i = 0; i < 560; i += 1) {
      const angle = Math.random() * Math.PI * 2
      // extremely high initial directional blast velocity
      const speed = 8 + Math.random() * 34
      shards.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.6,
        size: 2 + Math.random() * 9,
        life: 1,
        color: palette[Math.floor(Math.random() * palette.length)],
        drag: 0.9 + Math.random() * 0.07, // random fluid drag coefficient
      })
    }

    // persistent smudge layer that permanently paints the screen boundaries
    const smudge = document.createElement('canvas')
    smudge.width = W * dpr
    smudge.height = H * dpr
    const sctx = smudge.getContext('2d')
    if (sctx) sctx.scale(dpr, dpr)

    const start = performance.now()

    function frame(now: number) {
      const elapsed = now - start
      if (!ctx) return
      ctx.clearRect(0, 0, W, H)

      // fading dark wash
      ctx.fillStyle = `rgba(5,2,2,${Math.min(0.6, elapsed / 4000)})`
      ctx.fillRect(0, 0, W, H)

      // draw the permanent accumulated smudge underneath the live particles
      if (sctx) ctx.drawImage(smudge, 0, 0, W, H)

      shards.forEach((s) => {
        s.vy += 0.5 // gravity
        s.vx *= s.drag // fluid drag decay
        s.vy *= s.drag
        s.x += s.vx
        s.y += s.vy
        s.rot += s.vr
        s.life -= 0.006

        // clamp to screen boundaries and permanently paint dark-red pools there
        if (sctx) {
          if (s.x < 4 || s.x > W - 4 || s.y < 4 || s.y > H - 4) {
            sctx.globalAlpha = 0.5
            sctx.fillStyle = '#4a0000'
            sctx.beginPath()
            sctx.arc(Math.max(2, Math.min(W - 2, s.x)), Math.max(2, Math.min(H - 2, s.y)), s.size * 1.6, 0, Math.PI * 2)
            sctx.fill()
            sctx.globalAlpha = 1
          }
        }

        ctx.save()
        ctx.translate(s.x, s.y)
        ctx.rotate(s.rot)
        ctx.globalAlpha = Math.max(0, s.life)
        ctx.fillStyle = s.color
        ctx.beginPath()
        ctx.arc(0, 0, s.size * 0.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      // growing pool at the bottom
      const poolH = Math.min(H * 0.32, (elapsed / 4000) * H * 0.32)
      const grad = ctx.createLinearGradient(0, H - poolH, 0, H)
      grad.addColorStop(0, 'rgba(74,0,0,0)')
      grad.addColorStop(1, 'rgba(74,0,0,0.9)')
      ctx.fillStyle = grad
      ctx.fillRect(0, H - poolH, W, poolH)

      if (elapsed < 4000) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        ctx.clearRect(0, 0, W, H)
        doneRef.current?.()
      }
    }
    rafRef.current = requestAnimationFrame(frame)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [active, originX, originY])

  if (!active) return null
  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[9998]"
      style={{ width: '100vw', height: '100vh' }}
      aria-hidden="true"
    />
  )
}
