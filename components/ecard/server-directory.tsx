'use client'

import { type ActiveServer, publicWaitingServers } from '@/lib/ecard/servers'
import { formatCoin } from '@/lib/ecard/leaderboard'

interface ServerDirectoryProps {
  servers: ActiveServer[]
  onJoin: (roomId: string) => void
}

/**
 * "BÀN CƯỢC ĐANG TRỐNG / AVAILABLE MATCHES" — the public directory. Only
 * rooms that are public and WAITING are listed; JOIN connects instantly and
 * bypasses manual room-code typing.
 */
export function ServerDirectory({ servers, onJoin }: ServerDirectoryProps) {
  const open = publicWaitingServers(servers)

  return (
    <div className="deep-panel ring-1 ring-inset ring-red-950/20 rounded-lg border border-border bg-card/70 p-4 backdrop-blur">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-lg uppercase tracking-[0.15em] text-gold">Bàn Cược Đang Trống</h3>
        <span className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground">Available Matches</span>
      </div>

      <div className="thin-scroll max-h-[220px] overflow-y-auto">
        <table className="w-full border-collapse font-sans text-sm">
          <thead className="sticky top-0 bg-card/95">
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-2">Host</th>
              <th className="py-2 pr-2">Phe</th>
              <th className="py-2 pr-2 text-right">Cược</th>
              <th className="py-2 text-right">Vào</th>
            </tr>
          </thead>
          <tbody>
            {open.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center font-sans text-xs text-muted-foreground">
                  Không có bàn công khai nào. Hãy tạo phòng của riêng ngươi.
                </td>
              </tr>
            )}
            {open.map((s) => (
              <tr key={s?.id} className="border-t border-border/60 text-foreground/90">
                <td className="py-2 pr-2">
                  <span className="font-semibold text-foreground">{s?.hostName ?? 'Kẻ Vô Danh'}</span>
                  <span className="ml-1 font-display text-[10px] tracking-widest text-muted-foreground">{s?.id}</span>
                </td>
                <td className="py-2 pr-2">
                  <span style={{ color: s?.faction === 'KING' ? 'var(--gold)' : 'var(--blood)' }}>
                    {s?.faction === 'KING' ? 'Hoàng Đế' : 'Nô Lệ'}
                  </span>
                </td>
                <td className="py-2 pr-2 text-right text-blood">{formatCoin(s?.wager)}</td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onJoin(s?.id)}
                    disabled={s.bot}
                    className={`rounded border px-3 py-1 font-sans text-xs font-semibold uppercase tracking-wider transition-colors ${
                      s.bot 
                        ? 'bg-zinc-800 text-zinc-600 border-zinc-700 cursor-not-allowed' 
                        : 'border-gold/60 bg-gold/10 text-gold hover:bg-gold/20'
                    }`}
                  >
                    {s.bot ? 'LOCKED' : 'Vào Ngay / Join'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
