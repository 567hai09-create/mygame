// ======================================================================
// PUBLIC SERVER DIRECTORY — "Danh Sách Phòng Công Khai"
// A shared active-room matrix persisted to localStorage so the directory
// survives refreshes and simulates a live world dashboard. Private rooms
// are registered but hidden from the public listing.
// ======================================================================

import type { Faction } from '@/lib/ecard/game'

export type ServerStatus = 'WAITING' | 'INGAME'

export interface ActiveServer {
  id: string // Room Code
  hostName: string
  wager: number
  faction: Faction
  isPrivate: boolean
  status: ServerStatus
  bot?: boolean
  createdAt: number
}

const KEY = 'ecard.active-servers.v1'

const SEED: ActiveServer[] = [
  { id: 'KG8832', hostName: 'Tonegawa_CEO', wager: 300_000_000, faction: 'KING', isPrivate: false, status: 'WAITING', bot: true, createdAt: 0 },
  { id: 'VIP999', hostName: 'Endou_Loan', wager: 500_000_000, faction: 'KING', isPrivate: false, status: 'WAITING', bot: true, createdAt: 0 },
  { id: 'SLV417', hostName: 'Kaiji_Ito', wager: 100_000_000, faction: 'SLAVE', isPrivate: false, status: 'WAITING', bot: true, createdAt: 0 },
  { id: 'RUN666', hostName: 'Sahara_Run', wager: 80_000_000, faction: 'SLAVE', isPrivate: false, status: 'INGAME', bot: true, createdAt: 0 },
]

export function loadServers(): ActiveServer[] {
  if (typeof window === 'undefined') return SEED
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) {
      window.localStorage.setItem(KEY, JSON.stringify(SEED))
      return SEED
    }
    const parsed = JSON.parse(raw) as ActiveServer[]
    if (!Array.isArray(parsed)) return SEED
    return parsed
  } catch {
    return SEED
  }
}

export function saveServers(rows: ActiveServer[]): ActiveServer[] {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(rows))
    } catch {
      /* ignore */
    }
  }
  return rows
}

/** Register a freshly created room in the shared directory. */
export function registerServerRoom(server: ActiveServer): ActiveServer[] {
  const rows = loadServers().filter((r) => r?.id !== server.id)
  rows.unshift(server)
  return saveServers(rows)
}

/**
 * Server Destruction Lifecycle — scrub a room from the shared matrix the
 * instant the host surrenders, unmounts, exits the match, or the session ends.
 */
export function unregisterServerRoom(roomId?: string): ActiveServer[] {
  if (!roomId) return loadServers()
  const rows = loadServers().filter((r) => r?.id !== roomId)
  return saveServers(rows)
}

/** Only public rooms still waiting for an opponent are joinable from the list. */
export function publicWaitingServers(rows: ActiveServer[]): ActiveServer[] {
  return (rows ?? []).filter((r) => r?.isPrivate === false && r?.status === 'WAITING')
}
