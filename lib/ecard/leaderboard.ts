// ======================================================================
// "BẢNG PHONG THẦN" — THE HALL OF THE DAMNED (localStorage persistence)
// ======================================================================

export interface DamnedRecord {
  fingerprint?: string
  name: string
  debt: number // total debt accrued (Coin — virtual in-game currency only)
  wins: number // match/round wins
  deaths: number // Số Lần Chết — total executions survived
  isBot?: boolean
  role?: 'none' | 'escaped' | 'admin'
}

const KEY = 'ecard.hall-of-the-damned.v1'
const LOCK_KEY = 'ecard.dungeon-lock.v1'
const COOL_DOWN_MS = 60_000

const SEED: DamnedRecord[] = [
  { name: 'Kaiji Itō', debt: 10_000_000_000, wins: 45, deaths: 73, isBot: true },
  { name: 'Tonegawa', debt: 5_000_000_000, wins: 30, deaths: 12, isBot: true },
  { name: 'Furuhata', debt: 3_800_000_000, wins: 5, deaths: 29, isBot: true },
  { name: 'Endō', debt: 2_400_000_000, wins: 18, deaths: 21, isBot: true },
  { name: 'Chairman Hyodo', debt: 0, wins: 120, deaths: 3, isBot: true },
]

function sortDamned(rows: DamnedRecord[]): DamnedRecord[] {
  // Separate escaped players from the common list as per user request
  return [...rows].sort((a, b) => (b?.deaths ?? 0) - (a?.deaths ?? 0) || (b?.debt ?? 0) - (a?.debt ?? 0))
}

export function loadLeaderboard(): DamnedRecord[] {
  if (typeof window === 'undefined') return sortDamned(SEED)
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) {
      window.localStorage.setItem(KEY, JSON.stringify(SEED))
      return sortDamned(SEED)
    }
    const parsed = JSON.parse(raw) as DamnedRecord[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.setItem(KEY, JSON.stringify(SEED))
      return sortDamned(SEED)
    }
    return sortDamned(parsed)
  } catch {
    return sortDamned(SEED)
  }
}

export function saveLeaderboard(rows: DamnedRecord[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(sortDamned(rows)))
  } catch {
    /* ignore quota errors */
  }
}

/** Record an execution/defeat for a player, using fingerprint as unique ID. */
export function recordDeath(
  name: string,
  opts: { debt?: number; wins?: number; fingerprint?: string; role?: 'none' | 'escaped' | 'admin' } = {},
): DamnedRecord[] {
  const rows = loadLeaderboard()
  const cleanName = (name ?? 'Kẻ Vô Danh').trim() || 'Kẻ Vô Danh'
  const fp = opts.fingerprint
  
  // Try to find by fingerprint first, then fallback to name for bots or old records
  const existing = fp 
    ? rows.find((r) => r?.fingerprint === fp && !r?.isBot)
    : rows.find((r) => r?.name === cleanName && !r?.isBot)

  if (existing) {
    existing.deaths = (existing.deaths ?? 0) + 1
    existing.debt = (existing.debt ?? 0) + (opts.debt ?? 0)
    existing.wins = (existing.wins ?? 0) + (opts.wins ?? 0)
    if (opts.role) existing.role = opts.role
    if (fp) existing.fingerprint = fp
    existing.name = cleanName
  } else {
    rows.push({
      fingerprint: fp,
      name: cleanName,
      debt: opts.debt ?? 0,
      wins: opts.wins ?? 0,
      deaths: 1,
      role: opts.role ?? 'none'
    })
  }
  const sorted = sortDamned(rows)
  saveLeaderboard(sorted)
  return sorted
}

/** Add wins / debt without a death (e.g. surviving the gauntlet). */
export function recordProgress(
  name: string,
  opts: { debt?: number; wins?: number; fingerprint?: string; role?: 'none' | 'escaped' | 'admin' } = {},
): DamnedRecord[] {
  const rows = loadLeaderboard()
  const cleanName = (name ?? 'Kẻ Vô Danh').trim() || 'Kẻ Vô Danh'
  const fp = opts.fingerprint

  const existing = fp 
    ? rows.find((r) => r?.fingerprint === fp && !r?.isBot)
    : rows.find((r) => r?.name === cleanName && !r?.isBot)

  if (existing) {
    existing.debt = (existing.debt ?? 0) + (opts.debt ?? 0)
    existing.wins = (existing.wins ?? 0) + (opts.wins ?? 0)
    if (opts.role) existing.role = opts.role
    if (fp) existing.fingerprint = fp
    existing.name = cleanName
  } else {
    rows.push({ 
      fingerprint: fp,
      name: cleanName, 
      debt: opts.debt ?? 0, 
      wins: opts.wins ?? 0, 
      deaths: 0,
      role: opts.role ?? 'none'
    })
  }
  const sorted = sortDamned(rows)
  saveLeaderboard(sorted)
  return sorted
}

/** Formats a Coin amount (virtual in-game currency, no real-money value). */
export function formatCoin(n: number): string {
  const v = n ?? 0
  if (v >= 1_000_000_000) return `🪙 ${(v / 1_000_000_000).toFixed(1)}B COIN`
  if (v >= 1_000_000) return `🪙 ${(v / 1_000_000).toFixed(0)}M COIN`
  if (v >= 1_000) return `🪙 ${(v / 1_000).toFixed(0)}K COIN`
  return `🪙 ${v} COIN`
}


// ---- Refresh-proof dungeon lockout persistence -------------------------
export interface DungeonLockState {
  locked: boolean
  until: number // epoch ms
}

export function loadDungeonLock(): DungeonLockState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(LOCK_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DungeonLockState
    if (parsed?.locked && (parsed?.until ?? 0) > Date.now()) return parsed
    window.sessionStorage.removeItem(LOCK_KEY)
    return null
  } catch {
    return null
  }
}

export function saveDungeonLock(untilMs: number) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(LOCK_KEY, JSON.stringify({ locked: true, until: untilMs }))
  } catch {
    /* ignore */
  }
}

export function clearDungeonLock() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(LOCK_KEY)
  } catch {
    /* ignore */
  }
}

export function getDungeonCooldownMs() {
  return COOL_DOWN_MS
}
