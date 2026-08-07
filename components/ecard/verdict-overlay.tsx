"use client"

import { useEffect, useRef, useState } from "react"

interface VerdictOverlayProps {
  /** 'despair' = defeat, 'survived' = victory, null = hidden */
  verdict: "despair" | "survived" | null
  onComplete?: () => void
}

/**
 * Full-screen cinematic verdict card. DESPAIR renders a violent red screen
 * shake with a shattering title; SURVIVED renders a strobing gold triumph.
 * Both use CRT scanlines and auto-dismiss after their sequence resolves.
 */
export function VerdictOverlay({ verdict, onComplete }: VerdictOverlayProps) {
  const [stage, setStage] = useState<"enter" | "hold" | "out">("enter")
  const doneRef = useRef(onComplete)
  doneRef.current = onComplete

  useEffect(() => {
    if (!verdict) return
    setStage("enter")
    const t1 = window.setTimeout(() => setStage("hold"), 700)
    const t2 = window.setTimeout(() => setStage("out"), 3200)
    const t3 = window.setTimeout(() => doneRef.current?.(), 3900)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [verdict])

  if (!verdict) return null

  const isDespair = verdict === "despair"

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden scanlines"
      role="alertdialog"
      aria-live="assertive"
      aria-label={isDespair ? "Tuyệt vọng — bạn đã thua" : "Sống sót — bạn đã thắng"}
      style={{
        opacity: stage === "out" ? 0 : 1,
        transition: "opacity 0.6s ease",
      }}
    >
      {/* base tint */}
      <div
        className={isDespair ? "absolute inset-0 gold-flash" : ""}
        style={{
          backgroundColor: isDespair ? "rgba(20,0,0,0.92)" : undefined,
          background: isDespair
            ? "radial-gradient(circle at center, rgba(90,0,0,0.9), rgba(8,0,0,0.98))"
            : "radial-gradient(circle at center, rgba(45,35,10,0.94), rgba(6,4,0,0.98))",
        }}
      />

      {/* content */}
      <div
        className={`relative flex flex-col items-center text-center px-6 ${
          isDespair && stage !== "out" ? "violent-shake" : ""
        }`}
      >
        <span
          className="font-display uppercase tracking-[0.08em] leading-none"
          style={{
            fontSize: "clamp(3.5rem, 14vw, 11rem)",
            color: isDespair ? "#ff2b2b" : "#f5d97a",
            textShadow: isDespair
              ? "0 0 30px rgba(255,0,0,0.9), 0 6px 0 rgba(60,0,0,0.8)"
              : "0 0 40px rgba(245,217,122,0.9), 0 4px 0 rgba(80,60,0,0.7)",
            transform: stage === "enter" ? "scale(1.6)" : "scale(1)",
            transition: "transform 0.45s cubic-bezier(0.2,0.9,0.2,1)",
            filter: isDespair ? "blur(0.4px)" : "none",
          }}
        >
          {isDespair ? "TUYỆT VỌNG" : "SỐNG SÓT"}
        </span>
        <span
          className="mt-4 font-mono text-xs md:text-sm uppercase tracking-[0.4em]"
          style={{
            color: isDespair ? "rgba(255,150,150,0.75)" : "rgba(245,217,122,0.75)",
            opacity: stage === "enter" ? 0 : 1,
            transition: "opacity 0.6s ease 0.3s",
          }}
        >
          {isDespair ? "Bản án đã được thi hành" : "Ngươi đã cược mạng và thắng"}
        </span>
      </div>
    </div>
  )
}
