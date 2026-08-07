'use client'

import { useRef, useState } from 'react'
import type { CardType } from '@/lib/ecard/game'

interface PlayingCardProps {
  type: CardType
  faceUp: boolean
  selected?: boolean
  disabled?: boolean
  small?: boolean
  onSelect?: () => void
}

const MAX_TILT = 15

const INDEX_LETTER: Record<CardType, string> = {
  EMPEROR: 'E',
  SLAVE: 'S',
  CITIZEN: 'C',
}

function IndexGlyph({ type }: { type: CardType }) {
  // tiny corner-pip icon, mirrors the center emblem at a glance
  if (type === 'EMPEROR') {
    return (
      <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
        <path
          d="M4 17 L6 8 L10 13 L12 6 L14 13 L18 8 L20 17 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (type === 'SLAVE') {
    return (
      <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
        <circle cx="9" cy="10" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="15" cy="14" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path
        d="M8 6 Q12 3 16 6 Q18 12 14 19 Q12 21 10 19 Q6 12 8 6 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Emblem({ type }: { type: CardType }) {
  if (type === 'EMPEROR') {
    // regal crown with jeweled points, banded base and a crossed scepter beneath
    return (
      <svg viewBox="0 0 100 100" width="62%" role="img" aria-label="Emperor crown">
        <defs>
          <radialGradient id="emp-glow" cx="50%" cy="38%" r="55%">
            <stop offset="0%" stopColor="rgba(217,180,106,0.35)" />
            <stop offset="100%" stopColor="rgba(217,180,106,0)" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="42" r="42" fill="url(#emp-glow)" />
        <g fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinejoin="round">
          <path d="M18 68 L24 32 L38 52 L50 22 L62 52 L76 32 L82 68 Z" />
          <path d="M18 68 L82 68 L80 78 L20 78 Z" fill="#1d1611" />
          <circle cx="50" cy="17" r="3.6" fill="var(--gold)" />
          <circle cx="25" cy="28" r="2.6" fill="var(--gold)" />
          <circle cx="75" cy="28" r="2.6" fill="var(--gold)" />
          <circle cx="50" cy="60" r="3.2" fill="#7a1f20" stroke="var(--gold)" strokeWidth="1.4" />
        </g>
        <line x1="50" y1="82" x2="50" y2="94" stroke="var(--gold)" strokeWidth="2" />
        <line x1="43" y1="88" x2="57" y2="88" stroke="var(--gold)" strokeWidth="2" />
      </svg>
    )
  }
  if (type === 'SLAVE') {
    // broken manacles: two shattered cuffs with a snapped link between them
    return (
      <svg viewBox="0 0 100 100" width="62%" role="img" aria-label="Slave broken chains">
        <defs>
          <radialGradient id="slv-glow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="rgba(158,42,43,0.32)" />
            <stop offset="100%" stopColor="rgba(158,42,43,0)" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="48" r="42" fill="url(#slv-glow)" />
        <g fill="none" stroke="var(--blood)" strokeWidth="2.4" strokeLinecap="round">
          <ellipse cx="30" cy="36" rx="12" ry="14" />
          <ellipse cx="70" cy="60" rx="12" ry="14" />
          <path d="M40 40 L48 46 M44 32 L56 62 M40 30 L18 20 M22 42 L10 50" />
          <path d="M60 56 L52 50 M56 68 L44 38 M60 66 L82 76 M78 54 L90 46" />
        </g>
        <circle cx="30" cy="36" r="3" fill="var(--blood)" />
        <circle cx="70" cy="60" r="3" fill="var(--blood)" />
      </svg>
    )
  }
  // weathered stone mask, plain and worn — the anonymous common folk
  return (
    <svg viewBox="0 0 100 100" width="56%" role="img" aria-label="Citizen mask">
      <defs>
        <radialGradient id="cit-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="rgba(140,150,158,0.22)" />
          <stop offset="100%" stopColor="rgba(140,150,158,0)" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="48" r="40" fill="url(#cit-glow)" />
      <g fill="none" stroke="var(--citizen)" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M32 24 Q50 16 68 24 Q76 50 62 78 Q50 88 38 78 Q24 50 32 24 Z" />
        <path d="M38 44 h10 M52 44 h10" />
        <path d="M50 30 L46 62 L54 62" />
        <path d="M40 70 Q50 76 60 70" />
      </g>
      <line x1="50" y1="16" x2="46" y2="88" stroke="#0a0805" strokeWidth="1.3" />
    </svg>
  )
}

export function PlayingCard({
  type,
  faceUp,
  selected = false,
  disabled = false,
  small = false,
  onSelect,
}: PlayingCardProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const w = small ? 64 : 92
  const h = small ? 96 : 138

  function applyTilt(clientX: number, clientY: number) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (clientX - rect.left) / rect.width - 0.5
    const py = (clientY - rect.top) / rect.height - 0.5
    setTilt({
      x: Math.max(-MAX_TILT, Math.min(MAX_TILT, px * MAX_TILT * 2)),
      y: Math.max(-MAX_TILT, Math.min(MAX_TILT, -py * MAX_TILT * 2)),
    })
  }

  function reset() {
    setTilt({ x: 0, y: 0 })
  }

  const rim = type === 'EMPEROR' ? 'var(--gold)' : type === 'SLAVE' ? 'var(--blood)' : 'var(--border)'
  const indexColor = type === 'EMPEROR' ? 'var(--gold)' : type === 'SLAVE' ? 'var(--blood)' : 'var(--citizen)'

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      onClick={() => onSelect?.()}
      onMouseMove={(e) => !small && applyTilt(e.clientX, e.clientY)}
      onMouseLeave={reset}
      onTouchStart={(e) => {
        const t = e.touches[0]
        if (t && !small) applyTilt(t.clientX, t.clientY)
      }}
      onTouchMove={(e) => {
        const t = e.touches[0]
        if (t && !small) applyTilt(t.clientX, t.clientY)
      }}
      onTouchEnd={reset}
      className="relative shrink-0 rounded-md disabled:cursor-not-allowed"
      style={{
        width: w,
        height: h,
        perspective: 1000,
        cursor: disabled ? 'not-allowed' : 'pointer',
        outline: 'none',
      }}
      aria-pressed={selected}
      aria-label={faceUp ? `${type} card` : 'Face-down card'}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          willChange: 'transform, filter',
          transition: 'transform 0.2s ease-out, filter 0.3s ease-out',
          transform: selected
            ? 'translateY(-24px) translateZ(30px) rotateY(5deg)'
            : `rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) translateZ(8px)`,
          filter: selected
            ? `drop-shadow(0 26px 22px rgba(0,0,0,0.9)) drop-shadow(0 0 14px ${rim})`
            : `drop-shadow(${-tilt.x * 1.4}px ${tilt.y * 1.4}px 12px rgba(0,0,0,0.85))`,
        }}
      >
        {faceUp ? (
          <div
            className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[7px]"
            style={{
              background: 'radial-gradient(circle at 50% 32%, #241d15 0%, var(--parchment) 58%, #0a0805 100%)',
              border: `1.5px solid ${rim}`,
              boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 0 22px rgba(0,0,0,0.75), 0 0 8px ${
                selected ? rim : 'transparent'
              }`,
            }}
          >
            {/* inner filigree line, set slightly in from the outer rim */}
            <div
              className="pointer-events-none absolute rounded-[4px]"
              style={{
                inset: small ? 3 : 5,
                border: `1px solid ${rim}`,
                opacity: 0.55,
              }}
            />
            {/* corner index pips */}
            {!small && (
              <>
                <div
                  className="pointer-events-none absolute left-[6px] top-[5px] flex flex-col items-center gap-0.5"
                  style={{ color: indexColor }}
                >
                  <span className="font-display text-[11px] font-bold leading-none">{INDEX_LETTER[type]}</span>
                  <div style={{ width: 9, height: 9 }}>
                    <IndexGlyph type={type} />
                  </div>
                </div>
                <div
                  className="pointer-events-none absolute bottom-[5px] right-[6px] flex rotate-180 flex-col items-center gap-0.5"
                  style={{ color: indexColor }}
                >
                  <span className="font-display text-[11px] font-bold leading-none">{INDEX_LETTER[type]}</span>
                  <div style={{ width: 9, height: 9 }}>
                    <IndexGlyph type={type} />
                  </div>
                </div>
              </>
            )}
            <Emblem type={type} />
          </div>
        ) : (
          <div
            className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[7px]"
            style={{
              background: 'repeating-linear-gradient(45deg, #17130c, #17130c 6px, #120f09 6px, #120f09 12px)',
              border: '1.5px solid var(--gold-dim)',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 0 18px rgba(0,0,0,0.85)',
            }}
          >
            <div
              className="pointer-events-none absolute rounded-[4px]"
              style={{ inset: 4, border: '1px solid var(--gold-dim)', opacity: 0.6 }}
            />
            <svg viewBox="0 0 40 40" width="42%" aria-hidden="true">
              <circle cx="20" cy="20" r="14" fill="none" stroke="var(--gold-dim)" strokeWidth="1.5" />
              <path d="M12 20 L20 10 L28 20 L20 30 Z" fill="none" stroke="var(--gold-dim)" strokeWidth="1.5" />
            </svg>
          </div>
        )}
      </div>
    </button>
  )
}
