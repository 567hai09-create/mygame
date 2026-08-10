'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { GameMode } from '@/lib/ecard/game'
import { generateRoomCode } from '@/lib/ecard/game'
import { type DamnedRecord, formatCoin } from '@/lib/ecard/leaderboard'
import { type PlayerProfile, canUnlockCustomName, titleById } from '@/lib/ecard/profile'
import type { ActiveServer } from '@/lib/ecard/servers'
import type { GlobalChatMessage } from '@/components/ecard/types'
import { audio } from '@/lib/ecard/audio'
import { GlobalChat } from '@/components/ecard/global-chat'
import { AuthButton } from '@/components/ecard/auth-button'
import { ProfileShop } from '@/components/ecard/profile-shop'

export interface StartOpts {
  name: string
  roomCode?: string
  isPrivate?: boolean
  host?: boolean
  /** Coin stake attached to this table when hosting a real PVP room. */
  wager?: number
}

// Well-known id for the single shared public arena — anyone can walk in
// while it's empty; the instant a challenger takes the seat it locks and
// disappears from the "open" state for everyone else until the match ends.
const ARENA_ROOM_ID = 'SAN-DAU-CHUNG'

interface LobbyProps {
  leaderboard: DamnedRecord[]
  profile: PlayerProfile
  servers: ActiveServer[]
  onStart: (mode: GameMode, opts: StartOpts) => void
  onProfileNameChange: (name: string) => void
  onSaveProfile: (patch: { playerName?: string; currentTitleId?: string }) => void
  onReplayIntro?: () => void
  /** Real, shared WebSocket world chat — same feed shown live inside a match. */
  worldChatMessages: GlobalChatMessage[]
  onWorldChatSend: (text: string) => void
  wsConnected?: boolean
  isAdmin?: boolean
  onMutePlayer?: (clientId: string) => void
  onInvitePlayer?: (playerName: string) => void
  /** True while WE are hosting a real PVP table and genuinely waiting for a
   * real opponent to walk in (no bot ever fills this seat). */
  pvpWaiting?: boolean
  waitingRoomCode?: string
  onCancelPvpWaiting?: () => void
}

const DEFAULT_ROOM_WAGER = 50_000_000

export function Lobby({
  leaderboard,
  profile,
  servers,
  onStart,
  onProfileNameChange,
  onSaveProfile,
  onReplayIntro,
  worldChatMessages,
  onWorldChatSend,
  wsConnected,
  isAdmin,
  onMutePlayer,
  onInvitePlayer,
  pvpWaiting,
  waitingRoomCode,
  onCancelPvpWaiting,
}: LobbyProps) {
  const router = useRouter()
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [roomWager, setRoomWager] = useState(DEFAULT_ROOM_WAGER)
  const [shopOpen, setShopOpen] = useState(false)

  const nameUnlocked = canUnlockCustomName(profile)
  const cleanName = (profile?.playerName ?? '').trim() || 'Kẻ Vô Danh'
  const title = titleById(profile?.currentTitleId)

  // Filter public matches for the dashboard
  const publicMatches = useMemo(() => servers.filter(s => !s.isPrivate && s.status === 'WAITING'), [servers])

  // Filtered leaderboard: exclude escaped players from the common hall
  const commonLeaderboard = useMemo(() => leaderboard.filter(r => r.isBot || r.role === 'none'), [leaderboard])
  const escapedLeaderboard = useMemo(() => leaderboard.filter(r => r.role === 'escaped' || r.role === 'admin'), [leaderboard])

  // Shared arena state — undefined = empty/closed, WAITING = one player
  // seated and waiting, INGAME = full and locked.
  const arenaServer = useMemo(() => servers.find((s) => s.id === ARENA_ROOM_ID), [servers])
  const arenaIsMine = arenaServer?.hostName === cleanName

  const [showRoleSelection, setShowRoleSelection] = useState(false)

  useEffect(() => {
    setRoomCode('')
    setJoinCode('')
    setIsPrivate(false)
    setRoomWager(DEFAULT_ROOM_WAGER)
  }, [])

  useEffect(() => {
    if (profile.totalAccumulatedWinnings >= 10_000_000_000 && profile.role === 'none') {
      setShowRoleSelection(true)
    }
  }, [profile.totalAccumulatedWinnings, profile.role])

  function begin(mode: GameMode, opts: Partial<StartOpts> = {}) {
    audio.ensure?.()
    audio.startDrone?.()
    audio.click?.()
    onStart?.(mode, { name: cleanName, ...opts })
  }

  return (
    <div className="vignette relative min-h-screen w-full overflow-y-auto bg-[#050505] flex items-center justify-center p-4">
      <div className="flicker w-full max-w-5xl flex flex-col gap-12">
        {/* Header Section */}
        <header className="text-center space-y-2">
          <p className="font-sans text-[11px] uppercase tracking-[0.65em] text-[#c96a6b] opacity-90">Sinh Tử Cục · Death Match</p>
          <h1 className="font-display text-6xl font-black tracking-[0.22em] text-[#f2c96b] md:text-8xl drop-shadow-[0_0_24px_rgba(242,201,107,0.28)]">
            E&nbsp;·&nbsp;CARD
          </h1>
          <div className="h-[1px] w-32 bg-gradient-to-r from-transparent via-[#b3914a] to-transparent mx-auto mt-4" />
          <div className="mt-3 flex items-center justify-center gap-3">
            <AuthButton />
          </div>
          {onReplayIntro && (
            <button
              type="button"
              onClick={onReplayIntro}
              className="mt-3 rounded border border-zinc-700 bg-black/40 px-3 py-1.5 font-sans text-[10px] uppercase tracking-[0.25em] text-zinc-400 transition-colors hover:border-[#b3914a]/50 hover:text-[#b3914a]"
            >
              ↺ Xem Lại Câu Chuyện
            </button>
          )}
        </header>

        {/* LOBBY RE-ALIGNMENT: Balanced 2-column grid system */}
        <main className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          
          {/* Left Column (Game Modes Panel) */}
          <section className="flex flex-col space-y-4">
            <h2 className="font-display text-sm uppercase tracking-[0.24em] text-zinc-300 mb-2 px-1">Bảng Điều Khiển</h2>
            
            {/* Identity Input */}
            <div
              className="bg-[#0a0a0d] border border-zinc-800/50 p-4 rounded"
              style={{
                boxShadow:
                  '0 10px 30px -5px rgba(0,0,0,0.9), 0 20px 60px -10px rgba(0,0,0,0.95), inset 0 1px 0 0 rgba(255,255,255,0.03)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.28em] text-zinc-300">Định Danh</span>
                <button
                  type="button"
                  onClick={() => {
                    audio.click()
                    setShopOpen(true)
                  }}
                  className="rounded border border-[#b3914a]/60 bg-[#b3914a]/10 px-2 py-1 font-sans text-[10px] uppercase tracking-[0.24em] text-[#f6d27b] hover:bg-[#b3914a]/20 transition-colors"
                >
                  Mã Định Danh / Shop
                </button>
              </div>
              <input
                value={profile?.playerName ?? ''}
                onChange={(e) => onProfileNameChange?.(e.target.value)}
                disabled={!nameUnlocked}
                maxLength={24}
                placeholder="Kẻ Vô Danh"
                className="w-full bg-[#050505] border border-zinc-700 px-3 py-2 text-zinc-100 font-sans text-sm placeholder:text-zinc-500 focus:border-[#b3914a]/60 focus:outline-none transition-colors rounded-sm disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p className="mt-2 font-sans text-[11px] text-[#f1c66d]">
                {title?.vi ?? 'Con Bạc'}
                {profile.role === 'escaped' && <span className="ml-2 text-emerald-400">· KẺ THOÁT HIỂM</span>}
                {profile.role === 'admin' && <span className="ml-2 text-red-400">· QUẢN TRỊ</span>}
                {!nameUnlocked && (
                  <span className="ml-2 text-zinc-400">
                    · Đạt {formatCoin(50_000_000)} để mở khóa tên tùy chỉnh
                  </span>
                )}
              </p>
            </div>

            {/* START GAUNTLET Button */}
            {profile.role === 'admin' && (
              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="w-full rounded border border-red-900/40 bg-red-950/20 px-4 py-2 text-left text-[11px] uppercase tracking-[0.24em] text-red-300 transition-colors hover:border-red-700 hover:bg-red-950/30"
              >
                Admin Console
              </button>
            )}

            <button
              type="button"
              onClick={() => begin('AI')}
              className="group relative w-full overflow-hidden rounded border border-[#b3914a]/40 bg-gradient-to-br from-[#1a150e] to-[#0a0a0a] p-6 text-left transition-all hover:border-[#b3914a] hover:shadow-[0_0_20px_rgba(179,145,74,0.15)]"
            >
              <div className="relative z-10">
                <span className="block font-display text-3xl font-black tracking-[0.08em] text-[#f2c96b]">START GAUNTLET</span>
                <span className="mt-1 block font-sans text-xs uppercase tracking-[0.24em] text-zinc-300 group-hover:text-zinc-100 transition-colors">
                  Đấu với AI Hyodo — Trực diện & Tàn khốc
                </span>
              </div>
            </button>

            {/* ONLINE PK ROOM Panel */}
            <div className="bg-[#0c0907] border border-[#9e2a2b]/30 p-6 rounded shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <span className="font-display text-xl font-bold tracking-[0.16em] text-[#d96f70]">ONLINE PK ROOM</span>
                <div className="h-1.5 w-1.5 rounded-full bg-[#9e2a2b] animate-pulse" />
              </div>

              {/* SÀN ĐẤU CHUNG — shared public arena, locks the instant it fills */}
              <div className="space-y-2 rounded border border-[#b3914a]/25 bg-[#b3914a]/[0.04] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#f1c66d]">Sàn Đấu Chung</p>
                  <span
                    className={`flex items-center gap-1.5 text-[9px] uppercase tracking-widest ${
                      !arenaServer
                        ? 'text-emerald-400'
                        : arenaServer.status === 'WAITING'
                          ? 'text-amber-400'
                          : 'text-[#9e2a2b]'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        !arenaServer ? 'bg-emerald-400' : arenaServer.status === 'WAITING' ? 'bg-amber-400 animate-pulse' : 'bg-[#9e2a2b]'
                      }`}
                    />
                    {!arenaServer ? 'Trống' : arenaServer.status === 'WAITING' ? 'Đang chờ 1 người' : 'Đã khóa · Đang đấu'}
                  </span>
                </div>

                {!arenaServer && (
                  <>
                    <p className="text-[11px] leading-5 text-zinc-300">Ai cũng vào được, nhưng khi có người vào, sàn sẽ khóa ngay lập tức.</p>
                    <button
                      type="button"
                      onClick={() => begin('PVP', { roomCode: ARENA_ROOM_ID, isPrivate: false, host: true, wager: roomWager })}
                      className="w-full bg-[#b3914a]/80 hover:bg-[#b3914a] text-black py-2 font-bold text-xs uppercase tracking-[0.2em] transition-all rounded-sm"
                    >
                      Mở Sàn Đấu Chung
                    </button>
                  </>
                )}

                {arenaServer?.status === 'WAITING' && !arenaIsMine && (
                  <>
                    <p className="text-[11px] leading-5 text-zinc-300">
                      <span className="font-bold text-[#f1c66d]">{arenaServer.hostName}</span> đang chờ đối thủ tại đây.
                    </p>
                    <button
                      type="button"
                      onClick={() => begin('PVP', { roomCode: ARENA_ROOM_ID, host: false })}
                      className="w-full bg-[#9e2a2b]/80 hover:bg-[#9e2a2b] text-white py-2 font-bold text-xs uppercase tracking-[0.2em] transition-all rounded-sm"
                    >
                      Vào Sàn Đấu Chung Ngay
                    </button>
                  </>
                )}

                {arenaServer?.status === 'WAITING' && arenaIsMine && (
                  <p className="text-[11px] leading-5 text-[#f2c96b]">Bạn đang mở sàn — chờ một kẻ thách đấu bước vào...</p>
                )}

                {arenaServer?.status === 'INGAME' && (
                  <button
                    type="button"
                    disabled
                    className="w-full border border-zinc-800 text-zinc-600 py-2 font-bold text-xs uppercase tracking-[0.2em] rounded-sm cursor-not-allowed"
                  >
                    Đã Đủ Người — Đang Thi Đấu
                  </button>
                )}
              </div>

              <div className="h-[1px] w-full bg-zinc-800/50" />

              {/* Create Room */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-300">Tạo Phòng</p>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <span className="text-[9px] uppercase tracking-[0.24em] text-zinc-300 group-hover:text-zinc-100 transition-colors">Phòng Riêng Tư</span>
                    <input 
                      type="checkbox" 
                      checked={isPrivate} 
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="w-3 h-3 accent-[#9e2a2b]"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-[#050505] border border-zinc-800 px-4 py-2 font-display text-xl tracking-[0.4em] text-[#b3914a] flex items-center justify-center">
                    {roomCode || '------'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRoomCode(generateRoomCode())}
                    className="bg-zinc-900 border border-zinc-700 px-3 text-[10px] uppercase font-bold text-zinc-400 hover:text-white transition-colors"
                  >
                    Gen
                  </button>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] uppercase tracking-[0.24em] text-zinc-300">Mức Cược</span>
                    <span className="text-[10px] font-mono text-[#b3914a]">{formatCoin(roomWager)}</span>
                  </div>
                  <input
                    type="range"
                    min="10000000"
                    max="500000000"
                    step="10000000"
                    value={roomWager}
                    onChange={(e) => setRoomWager(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#9e2a2b]"
                  />
                </div>
                <button
                  disabled={!roomCode}
                  onClick={() => begin('PVP', { roomCode, isPrivate, host: true, wager: roomWager })}
                  className="w-full bg-[#9e2a2b]/80 hover:bg-[#9e2a2b] text-white py-2 font-bold text-xs uppercase tracking-[0.2em] transition-all disabled:opacity-30 rounded-sm"
                >
                  Host Match
                </button>
              </div>

              <div className="h-[1px] w-full bg-zinc-800/50" />

              {/* Join Room */}
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-300">Tham Gia</p>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="MÃ PHÒNG"
                  className="w-full bg-[#050505] border border-zinc-700 px-3 py-2 text-center font-display text-xl tracking-[0.36em] text-zinc-100 focus:border-[#9e2a2b]/60 outline-none transition-colors"
                />
                <button
                  disabled={joinCode?.length < 6}
                  onClick={() => begin('PVP', { roomCode: joinCode, host: false })}
                  className="w-full border border-[#9e2a2b]/50 text-[#9e2a2b] hover:bg-[#9e2a2b]/10 py-2 font-bold text-xs uppercase tracking-[0.2em] transition-all disabled:opacity-30 rounded-sm"
                >
                  Bind & Enter
                </button>
              </div>
            </div>
          </section>

          {/* Right Column (Global Chat & Available Matches) */}
          <section className="flex flex-col space-y-6">
            <div className="flex flex-col">
              <h2 className="font-display text-sm uppercase tracking-[0.24em] text-zinc-300 mb-2 px-1">Kênh Liên Lạc</h2>
              <GlobalChat 
                playerName={cleanName} 
                messages={worldChatMessages} 
                onSend={onWorldChatSend} 
                connected={wsConnected} 
                isAdmin={isAdmin}
                onMutePlayer={onMutePlayer}
                onInvitePlayer={onInvitePlayer}
              />
            </div>

            {/* BÀN CƯỢC ĐANG TRỐNG / AVAILABLE MATCHES */}
            <div className="flex flex-col">
              <h2 className="font-display text-sm uppercase tracking-[0.24em] text-zinc-300 mb-2 px-1">BÀN CƯỢC ĐANG TRỐNG</h2>
              <div
                className="bg-[#0a0a0d] border border-zinc-800 rounded overflow-hidden ring-1 ring-inset ring-red-950/20"
                style={{
                  boxShadow:
                    '0 10px 30px -5px rgba(0,0,0,0.9), 0 20px 60px -10px rgba(0,0,0,0.95), inset 0 1px 0 0 rgba(255,255,255,0.03)',
                }}
              >
                <div className="max-h-[200px] overflow-y-auto thin-scroll">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-[#121212] border-b border-zinc-800">
                      <tr className="text-[9px] uppercase tracking-[0.24em] text-zinc-300">
                        <th className="p-3">Host</th>
                        <th className="p-3">Wager</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {publicMatches.length > 0 ? (
                        publicMatches.map(s => (
                          <tr key={s.id} className="border-b border-zinc-900/50 hover:bg-zinc-900/30 transition-colors">
                            <td className="p-3 text-xs text-zinc-100 font-bold">{s.hostName}</td>
                            <td className="p-3 text-xs text-[#f1c66d] font-mono">{formatCoin(s.wager)}</td>
                            <td className="p-3 text-right">
                              <button 
                                onClick={() => begin('PVP', { roomCode: s.id, host: false })}
                                disabled={s.bot}
                                              className={`px-3 py-1 text-[9px] uppercase font-black tracking-[0.18em] transition-all rounded-sm ${
                                  s.bot 
                                    ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed' 
                                    : 'bg-[#9e2a2b]/20 border border-[#9e2a2b]/40 text-[#f3b1b3] hover:bg-[#9e2a2b] hover:text-white'
                                }`}
                              >
                                {s.bot ? 'BÀN BOT / LOCKED' : 'VÀO NGAY / JOIN'}
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-[10px] uppercase tracking-[0.24em] text-zinc-400 italic">
                            Chưa có bàn cược nào công khai...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="p-4 border border-zinc-900 bg-zinc-950/50 rounded flex justify-between items-center opacity-60">
              <div className="flex gap-4">
                <div className="text-[10px] uppercase tracking-[0.24em]">
                  <span className="text-zinc-400">Players:</span> <span className="text-emerald-400">1,204</span>
                </div>
                <div className="text-[10px] uppercase tracking-[0.24em]">
                  <span className="text-zinc-400">Active:</span> <span className="text-[#f1c66d]">82</span>
                </div>
              </div>
              <div className="text-[9px] font-mono text-zinc-500">STABLE_BUILD_080626</div>
            </div>
          </section>
        </main>

        {/* BẢNG PHONG THẦN / HALL OF THE DAMNED — Leaderboard */}
        <section className="flex flex-col">
          <h2 className="font-display text-sm uppercase tracking-[0.24em] text-zinc-300 mb-2 px-1">
            Bảng Phong Thần
          </h2>
          <div
            className="bg-[#0a0a0d] border border-zinc-800 rounded overflow-hidden ring-1 ring-inset ring-red-950/20"
            style={{
              boxShadow:
                '0 10px 30px -5px rgba(0,0,0,0.9), 0 20px 60px -10px rgba(0,0,0,0.95), inset 0 1px 0 0 rgba(255,255,255,0.03)',
            }}
          >
            <div className="max-h-[280px] overflow-y-auto thin-scroll">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#121212] border-b border-zinc-800">
                  <tr className="text-[9px] uppercase tracking-[0.24em] text-zinc-300">
                    <th className="p-3 w-10">#</th>
                    <th className="p-3">Tên / Name</th>
                    <th className="p-3 text-right">Thắng / Wins</th>
                    <th className="p-3 text-right">Số Lần Chết / Deaths</th>
                    <th className="p-3 text-right">Nợ / Debt</th>
                  </tr>
                </thead>
                <tbody>
                  {commonLeaderboard.length > 0 ? (
                    commonLeaderboard.slice(0, 20).map((row, i) => {
                      const isMe = !row.isBot && row.name === cleanName
                      return (
                        <tr
                          key={`${row.name}-${i}`}
                          className={`border-b border-zinc-900/50 transition-colors ${
                            isMe ? 'bg-[#9e2a2b]/10' : 'hover:bg-zinc-900/30'
                          }`}
                        >
                          <td className="p-3 text-xs font-mono text-zinc-400">
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                          </td>
                          <td className="p-3 text-xs font-bold text-zinc-100">
                            {row.name}
                            {isMe && <span className="ml-1.5 text-[9px] text-[#9e2a2b]">(BẠN)</span>}
                          </td>
                          <td className="p-3 text-xs text-right text-emerald-400 font-mono">{row.wins ?? 0}</td>
                          <td className="p-3 text-xs text-right text-[#f08d91] font-mono">{row.deaths ?? 0}</td>
                          <td className="p-3 text-xs text-right text-[#f1c66d] font-mono">{formatCoin(row.debt ?? 0)}</td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-[10px] uppercase tracking-[0.24em] text-zinc-400 italic">
                        Chưa có ai trong bảng phong thần...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {escapedLeaderboard.length > 0 && (
          <section className="flex flex-col">
            <h2 className="font-display text-sm uppercase tracking-[0.24em] text-emerald-400 mb-2 px-1">
              Hội Những Kẻ Thoát Hiểm
            </h2>
            <div
              className="bg-[#0a0a0d] border border-emerald-900/30 rounded overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.1)]"
            >
              <div className="max-h-[200px] overflow-y-auto thin-scroll">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#0c120e] border-b border-emerald-900/30">
                    <tr className="text-[9px] uppercase tracking-widest text-emerald-500/70">
                      <th className="p-3 w-10">#</th>
                      <th className="p-3">Tên / Name</th>
                      <th className="p-3 text-right">Vai Trò / Role</th>
                      <th className="p-3 text-right">Thắng / Wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escapedLeaderboard.map((row, i) => (
                      <tr key={`${row.name}-${i}`} className="border-b border-zinc-900/50 hover:bg-emerald-900/5 transition-colors">
                        <td className="p-3 text-xs font-mono text-emerald-400">{i + 1}</td>
                        <td className="p-3 text-xs font-bold text-emerald-400">{row.name}</td>
                        <td className="p-3 text-[9px] text-right uppercase tracking-[0.24em] text-zinc-300">
                          {row.role === 'admin' ? 'Quản Trị' : 'Đã Thoát'}
                        </td>
                        <td className="p-3 text-xs text-right text-emerald-400 font-mono">{row.wins ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
        <footer className="text-center opacity-30 hover:opacity-100 transition-opacity duration-700">
          <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-zinc-400">
            The Citizen governs the Slave. Yet a single Slave can topple the Emperor.
          </p>
        </footer>
      </div>

      {shopOpen && (
        <ProfileShop
          profile={profile}
          onClose={() => setShopOpen(false)}
          onSave={(patch) => onSaveProfile(patch)}
        />
      )}

      {pvpWaiting && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-lg border border-[#b3914a]/40 bg-[#0a0a0d] p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#b3914a]/30 border-t-[#b3914a]" />
            <h2 className="font-display text-xl font-black tracking-[0.2em] text-[#f2c96b]">ĐANG CHỜ ĐỐI THỦ</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Bàn <span className="font-mono text-[#f1c66d]">{waitingRoomCode || '------'}</span> đang mở — trận đấu chỉ bắt đầu khi có một người chơi thật bước vào.
            </p>
            <button
              type="button"
              onClick={onCancelPvpWaiting}
              className="mt-5 w-full rounded border border-zinc-700 py-2 text-xs uppercase tracking-[0.24em] text-zinc-300 hover:border-[#9e2a2b] hover:text-[#f3b1b3] transition-colors"
            >
              Hủy / Cancel
            </button>
          </div>
        </div>
      )}

      {showRoleSelection && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-lg border border-gold/50 bg-[#0a0a0d] p-8 text-center shadow-[0_0_50px_rgba(179,145,74,0.3)]">
            <h2 className="font-display text-3xl font-black tracking-[0.2em] text-gold mb-2">THOÁT KHỎI NGỤC TỐI</h2>
            <p className="text-sm text-zinc-400 mb-8 uppercase tracking-widest">Bạn đã đạt đủ 10 Tỷ Coin. Hãy chọn định mệnh của mình.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => {
                  onSaveProfile({ role: 'escaped' })
                  setShowRoleSelection(false)
                }}
                className="group p-6 border border-emerald-900/50 bg-emerald-900/10 hover:bg-emerald-900/20 transition-all rounded text-left"
              >
                <span className="block font-display text-xl font-bold text-emerald-400 mb-2">KẺ THOÁT HIỂM</span>
                <span className="block text-xs text-zinc-400 leading-relaxed">
                  Tự do đặt tên, không bị buộc phải chấp nhận các kỳ thi nguy hiểm. Bạn đã vượt qua tất cả.
                </span>
              </button>

              <button
                onClick={() => {
                  onSaveProfile({ role: 'admin' })
                  setShowRoleSelection(false)
                }}
                className="group p-6 border border-red-900/50 bg-red-900/10 hover:bg-red-900/20 transition-all rounded text-left"
              >
                <span className="block font-display text-xl font-bold text-red-500 mb-2">QUẢN TRỊ VIÊN</span>
                <span className="block text-xs text-zinc-400 leading-relaxed">
                  Trở thành người của "Bên Ác". Có quyền khóa chat, ẩn danh tính hoàn toàn và mời người chơi khác.
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
