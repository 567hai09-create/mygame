'use client'

import { useEffect, useState } from 'react'
import { audio } from '@/lib/ecard/audio'

interface IntroStoryProps {
  onFinish: () => void
}

interface Slide {
  eyebrow: string
  lines: string[]
}

const SLIDES: Slide[] = [
  {
    eyebrow: 'CHƯƠNG 0 · MẤT TRẮNG',
    lines: [
      'Anh thua. Không phải một ván — mà là tất cả.',
      'Chữ ký trên giấy nợ giờ nặng hơn cả cái tên anh đang mang.',
    ],
  },
  {
    eyebrow: 'ÁP GIẢI',
    lines: [
      'Người của chủ nợ không hỏi. Họ chỉ còng tay và đẩy anh xuống một cầu thang không có điểm cuối.',
      'Hầm lao động dưới lòng đất — nơi những kẻ nợ không trả nổi bị đưa tới để "làm việc trừ nợ".',
    ],
  },
  {
    eyebrow: 'DƯỚI LÒNG ĐẤT',
    lines: [
      'Không có ngày, không có đêm. Chỉ có tiếng xẻng và tiếng đếm giờ của cai ngục.',
      'Phải đủ số ngày công quy định — hàng tháng trời — mới đủ điều kiện được dẫn lên mặt đất một lần.',
    ],
  },
  {
    eyebrow: 'MỘT LỐI TẮT',
    lines: [
      'Nhưng có một cách khác để lên mặt đất sớm hơn — và trả dứt món nợ ngay lập tức.',
      'Bọn cho vay tổ chức một trò chơi bài riêng cho những kẻ như anh, sâu trong khu nhà cấm của hầm mỏ.',
    ],
  },
  {
    eyebrow: 'ĐẾ VƯƠNG BÀI',
    lines: [
      'Luật chơi tàn nhẫn, nhưng phần thưởng thì rõ ràng: thắng — được xóa nợ, được lên mặt đất, được gọi lại bằng tên thật.',
      'Thua — mất mạng, hoặc quay về hầm tối không hẹn ngày ra.',
    ],
  },
  {
    eyebrow: 'CÁI TÊN CỦA ANH',
    lines: [
      'Ở đây anh chỉ là một con số trên danh sách nợ. Không ai gọi tên anh nữa.',
      'Ngồi xuống bàn. Rút bài. Đây là cách duy nhất để lấy lại cái tên đó.',
    ],
  },
]

const SEEN_KEY = 'ecard_intro_seen'

export function hasSeenIntro(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markIntroSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

export function IntroStory({ onFinish }: IntroStoryProps) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [index])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish()
      if (e.key === 'Enter' || e.key === ' ') advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  function advance() {
    audio.click?.()
    if (index < SLIDES.length - 1) {
      setIndex((i) => i + 1)
    } else {
      finish()
    }
  }

  function finish() {
    audio.click?.()
    markIntroSeen()
    onFinish()
  }

  const slide = SLIDES[index]
  const isLast = index === SLIDES.length - 1

  return (
    <div
      className="fixed inset-0 z-[9000] flex flex-col items-center justify-center overflow-hidden bg-black px-6"
      role="dialog"
      aria-label="Cốt truyện mở đầu"
    >
      {/* iron-bar cell texture, faint, behind the text */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, #000 0 10px, transparent 10px 64px), repeating-linear-gradient(90deg, rgba(120,120,130,0.35) 0 2px, transparent 2px 10px)',
        }}
      />
      {/* deep vignette + faint candle glow at top-center */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 20%, rgba(179,145,74,0.08) 0%, rgba(0,0,0,0) 45%), radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.75) 78%, rgba(0,0,0,0.98) 100%)',
        }}
      />

      <button
        type="button"
        onClick={finish}
        className="absolute right-5 top-5 z-10 rounded border border-zinc-700 bg-black/50 px-3 py-1.5 font-sans text-[11px] uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:border-gold/50 hover:text-gold"
      >
        Bỏ Qua ›
      </button>

      <div
        className="relative z-10 flex max-w-xl flex-col items-center gap-6 text-center transition-opacity duration-500 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(10px)' }}
      >
        <span className="font-sans text-[11px] uppercase tracking-[0.45em] text-blood">{slide.eyebrow}</span>
        <div className="flex flex-col gap-4">
          {slide.lines.map((line, i) => (
            <p key={i} className="text-balance font-display text-lg leading-relaxed text-foreground md:text-xl">
              {line}
            </p>
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-10 flex flex-col items-center gap-5">
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === index ? 20 : 6,
                background: i === index ? 'var(--gold)' : 'rgba(255,255,255,0.18)',
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={advance}
          className="rounded-md border border-gold bg-gradient-to-b from-[#2a2210] to-[#171208] px-8 py-2.5 font-display text-sm uppercase tracking-widest text-gold shadow-[0_0_18px_rgba(179,145,74,0.18)] transition-transform hover:scale-[1.02]"
        >
          {isLast ? 'Ngồi Vào Bàn' : 'Tiếp Tục'}
        </button>
      </div>
    </div>
  )
}
