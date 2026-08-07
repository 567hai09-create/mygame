'use client'

import type { Faction } from '@/lib/ecard/game'

interface SilhouetteProps {
  faction: Faction
  side: 'left' | 'right'
  /** 0-5, how deep the drill has advanced */
  drillProgress?: number
  /** true while the execution split is animating */
  split?: boolean
  label: string
}

/**
 * PENSIVE FIGURE REDESIGN v2 — chin-on-fist seated silhouette, styled after
 * the classic "two men brooding over a game board" chiaroscuro composition:
 * a hooded, cloaked bust leaning forward in thought, warm rim-lit like a
 * single candle on the table between them. Pure SVG/CSS, no external art.
 *
 * Kẻ Vô Danh (Left/Slave, crimson rim, tattered collar) vs
 * Hyodo (Right/Emperor, gold rim, structured epaulette collar).
 */
export function Silhouette({ faction, side, drillProgress = 0, split = false, label }: SilhouetteProps) {
  const isLeft = side === 'left'
  const glowColor = isLeft ? '#9e2a2b' : '#b3914a'
  const glowSoft = isLeft ? '#c8484a' : '#d9bb72'
  const flickerDelay = isLeft ? '0s' : '1.3s' // desynced so both sides never flicker in unison
  const gradId = `rim-${side}-${faction}`
  const auraId = `aura-${side}-${faction}`

  return (
    <div
      className="relative flex flex-col items-center justify-end select-none"
      style={{ width: 176, height: 200 }}
      aria-label={label}
    >
      <div
        className="relative transition-transform duration-[2000ms] ease-[cubic-bezier(0.1,0.8,0.3,1)]"
        style={{
          width: 132,
          height: 176,
          animation: `candle-rim-flicker 4.2s ease-in-out infinite`,
          animationDelay: flickerDelay,
          filter: `drop-shadow(0 0 15px ${glowColor})`,
          transform: split ? (isLeft ? 'translate(24px,-40px) rotate(11deg)' : 'translate(-24px,-40px) rotate(-11deg)') : 'none',
        }}
      >
        {/* Soft ambient candle-glow pooling behind the figure */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 150,
            height: 150,
            left: isLeft ? -10 : -8,
            top: 10,
            background: `radial-gradient(circle, ${glowColor}33 0%, transparent 70%)`,
          }}
        />

        <svg
          viewBox="0 0 132 176"
          width={132}
          height={176}
          style={{ transform: isLeft ? 'none' : 'scaleX(-1)', position: 'relative' }}
        >
          <defs>
            {/* Rim-lit body gradient: near-black core, warm edge catching the candle */}
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="20%">
              <stop offset="0%" stopColor="#050506" />
              <stop offset="62%" stopColor="#0a0a0d" />
              <stop offset="88%" stopColor={glowColor} stopOpacity="0.55" />
              <stop offset="100%" stopColor={glowSoft} stopOpacity="0.85" />
            </linearGradient>
            <radialGradient id={auraId} cx="70%" cy="30%" r="70%">
              <stop offset="0%" stopColor={glowSoft} stopOpacity="0.25" />
              <stop offset="100%" stopColor={glowSoft} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Cloaked torso, tapering out toward the desk — a figure leaning in.
              Softer shoulder curve + draped hem folds for a more sculpted read. */}
          <path
            d="M 24 176 L 19 120 Q 17 94 33 77 L 49 63 Q 58 55 66 55 L 79 55 Q 89 55 93 67 L 97 120 Q 99 150 101 176 Z"
            fill={`url(#${gradId})`}
          />
          {/* Drape fold lines down the cloak for sculptural depth */}
          <path d="M 44 82 Q 40 118 42 158" stroke="#000" strokeWidth="1.4" fill="none" opacity="0.45" />
          <path d="M 64 66 Q 61 110 63 168" stroke="#000" strokeWidth="1.2" fill="none" opacity="0.35" />
          <path d="M 82 78 Q 86 116 88 160" stroke="#000" strokeWidth="1.4" fill="none" opacity="0.4" />

          {/* Collar detail — distinct per faction */}
          {isLeft ? (
            /* Kẻ Vô Danh: ragged, uneven prison collar */
            <path d="M 51 61 Q 66 71 82 61 L 79 68 Q 66 76 53 68 Z" fill="#000" opacity="0.55" />
          ) : (
            /* Hyodo: structured epaulette / high collar of an "emperor" */
            <path d="M 49 60 Q 66 66 84 60 L 86 66 Q 66 74 47 66 Z" fill="#000" opacity="0.5" />
          )}
          {!isLeft && (
            <>
              <circle cx="90" cy="64" r="2.6" fill={glowSoft} opacity="0.8" />
              <circle cx="97" cy="70" r="1.8" fill={glowSoft} opacity="0.55" />
            </>
          )}

          {/* Bowed head, chin tucked low in thought, with a subtle jaw highlight */}
          <ellipse cx="70" cy="45" rx="17.5" ry="19.5" fill={`url(#${gradId})`} />
          <path d="M 82 40 Q 87 48 82 56" stroke={glowSoft} strokeWidth="1" fill="none" opacity="0.5" />
          {/* Hood/collar shadow line for depth */}
          <path d="M 52 60 Q 66 68 84 60" stroke="#000" strokeWidth="2" fill="none" opacity="0.6" />

          {/* Upper arm rising to the chin — smoother taper into a defined fist */}
          <path
            d="M 39 120 Q 33 97 45 79 Q 53 67 61 59 Q 65 55 62 50 Q 59 46 54 49 Q 45 55 39 67 Q 29 85 31 110 Q 32 120 39 120 Z"
            fill={`url(#${gradId})`}
          />
          {/* Fist resting under the chin — knuckle ridge for a readable hand shape */}
          <ellipse cx="60" cy="51" rx="7.5" ry="6" fill="#0a0a0d" />
          <path d="M 55 49 Q 60 46 65 49" stroke="#000" strokeWidth="1" fill="none" opacity="0.5" />

          {/* Far arm + hand flat on the table, echoing the wager, with loose fingers */}
          <path d="M 91 129 Q 104 126 113 133 L 113 150 Q 100 155 89 150 Z" fill="#07070a" />
          <path d="M 96 150 L 96 156 M 102 151 L 102 158 M 108 150 L 109 157" stroke="#000" strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />

          {/* Forearm block flat on the table (kept from original silhouette) */}
          <rect x="20" y="158" width="80" height="18" rx="4" fill="#07070a" />

          {/* Faint aura wash tying the whole figure to the candlelight */}
          <path
            d="M 24 176 L 19 120 Q 17 94 33 77 L 49 63 Q 58 55 66 55 L 79 55 Q 89 55 93 67 L 97 120 Q 99 150 101 176 Z"
            fill={`url(#${auraId})`}
          />
        </svg>
      </div>

      {/* Crimson slice line during execution */}
      {split && (
        <div
          className="absolute top-1/2 left-[-20px] right-[-20px] h-[3px] bg-[#ff2222] z-10 rotate-[-5deg]"
          style={{ filter: 'drop-shadow(0 0 6px #ff0000)' }}
        />
      )}

      {/* Mechanical ear-drill advancing toward the head - kept for game logic */}
      {drillProgress > 0 && !split && (
        <div
          className="absolute top-[34px] z-20"
          style={{
            left: isLeft ? 118 : -30,
            transform: `translateX(${isLeft ? -drillProgress * 16 : drillProgress * 16}px) ${!isLeft ? 'scaleX(-1)' : ''}`,
            transition: 'transform 0.4s ease-out',
            willChange: 'transform',
          }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 60 24" width={60} height={24}>
            <rect x="30" y="8" width="26" height="8" rx="1" fill="#3a3a42" stroke="#6b6b75" strokeWidth="0.6" />
            <rect x="24" y="9.5" width="8" height="5" fill="#8a8a94" />
            <polygon points="24,12 8,7 8,17" fill="#b7b7c0" stroke="#dcdce4" strokeWidth="0.5" />
            <line x1="14" y1="9" x2="20" y2="11" stroke="#5a5a63" strokeWidth="0.5" />
            <line x1="14" y1="15" x2="20" y2="13" stroke="#5a5a63" strokeWidth="0.5" />
          </svg>
        </div>
      )}
    </div>
  )
}
