'use client'

import { useState } from 'react'
import {
  type PlayerProfile,
  CUSTOM_NAME_COST,
  TITLES,
  canUnlockCustomName,
  isTitleUnlocked,
} from '@/lib/ecard/profile'
import { formatCoin } from '@/lib/ecard/leaderboard'
import { audio } from '@/lib/ecard/audio'

interface ProfileShopProps {
  profile: PlayerProfile
  onClose: () => void
  onSave: (patch: { playerName?: string; currentTitleId?: string }) => void
}

/**
 * "Mã Định Danh Nhân Vật Cao Cấp" — identity shop. Custom usernames and
 * prestige titles unlock strictly by lifetime winnings / wins / clean record.
 */
export function ProfileShop({ profile, onClose, onSave }: ProfileShopProps) {
  const nameUnlocked = canUnlockCustomName(profile)
  const [name, setName] = useState(profile?.playerName ?? '')
  const [titleId, setTitleId] = useState(profile?.currentTitleId ?? 'rookie')

  function commit() {
    audio.click()
    onSave({
      playerName: nameUnlocked ? name.trim().slice(0, 24) || undefined : undefined,
      currentTitleId: titleId,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/85 px-4" role="dialog" aria-modal="true">
      <div className="deep-panel thin-scroll max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-gold/40 bg-card p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-2xl tracking-widest text-gold">Mã Định Danh</h2>
          <button
            type="button"
            onClick={onClose}
            className="font-sans text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            Đóng ✕
          </button>
        </div>

        <p className="mb-4 rounded border border-gold/30 bg-gold/5 px-3 py-2 font-sans text-sm text-gold">
          Tài sản tích lũy: <span className="font-display">{formatCoin(profile?.totalAccumulatedWinnings)}</span>
          <span className="ml-2 text-muted-foreground">· {profile?.wins ?? 0} thắng · {profile?.forfeits ?? 0} đầu hàng</span>
        </p>

        {/* custom name */}
        <div className="mb-5">
          <label htmlFor="custom-name" className="font-sans text-xs uppercase tracking-widest text-muted-foreground">
            Tên Tùy Chỉnh / Custom Name
          </label>
          {nameUnlocked ? (
            <input
              id="custom-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="Nhập biệt danh của ngươi"
              className="mt-2 w-full rounded-md border border-input bg-background/60 px-3 py-2 font-sans text-lg text-foreground outline-none focus:border-gold"
            />
          ) : (
            <p className="mt-2 rounded-md border border-border bg-background/40 px-3 py-2 font-sans text-sm text-muted-foreground">
              Khóa — cần tối thiểu {formatCoin(CUSTOM_NAME_COST)} tài sản tích lũy để mở khóa tên tùy chỉnh.
            </p>
          )}
        </div>

        {/* titles */}
        <div>
          <p className="font-sans text-xs uppercase tracking-widest text-muted-foreground">Danh Hiệu / Prestige Titles</p>
          <div className="mt-2 flex flex-col gap-2">
            {TITLES.map((t) => {
              const unlocked = isTitleUnlocked(t, profile)
              const selected = t.id === titleId
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => {
                    audio.select()
                    setTitleId(t.id)
                  }}
                  className={`rounded-md border px-3 py-2 text-left transition-colors disabled:opacity-40 ${
                    selected ? 'border-gold bg-gold/15' : 'border-border bg-background/40 hover:border-gold/50'
                  }`}
                >
                  <span className="block font-display text-base tracking-wide text-foreground">{t.vi}</span>
                  <span className="block font-sans text-[11px] text-muted-foreground">
                    {unlocked
                      ? 'Đã mở khóa'
                      : `Cần ${formatCoin(t.minWinnings)}${t.minWins > 0 ? ` · ${t.minWins} thắng` : ''}${
                          t.maxForfeits === 0 ? ' · 0 lần đầu hàng' : ''
                        }`}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={commit}
          className="mt-5 w-full rounded-md border border-gold bg-gradient-to-b from-[#2a2210] to-[#171208] py-2.5 font-display text-sm uppercase tracking-widest text-gold hover:scale-[1.01]"
        >
          Lưu Định Danh / Save
        </button>
      </div>
    </div>
  )
}
