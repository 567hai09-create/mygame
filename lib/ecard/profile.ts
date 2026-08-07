// ======================================================================
// PERSISTENT IDENTITY MATRIX — KAIJI_PLAYER_PROFILE (localStorage)
// Refresh-proof name / title / lifetime-winnings retention + a tiered
// prestige-title unlock economy driven by accumulated winnings.
// ======================================================================

export const PROFILE_KEY = 'KAIJI_PLAYER_PROFILE'

export const DEFAULT_NAME = 'Kẻ Vô Danh'
export const DEFAULT_TITLE_ID = 'rookie'

// Threshold for special roles
export const SPECIAL_ROLE_THRESHOLD = 10_000_000_000 // 10B Coin

export type PlayerRole = 'none' | 'escaped' | 'admin'

export interface PlayerProfile {
  playerName: string
  currentTitle: string // resolved title label (vi/en)
  currentTitleId: string
  totalAccumulatedWinnings: number // lifetime Coin score (virtual in-game currency)
  wins: number // lifetime match/round wins
  forfeits: number // lifetime dungeon-lock forfeits
  customNameUnlocked: boolean
  role: PlayerRole
}

export interface PrestigeTitle {
  id: string
  vi: string
  en: string
  minWinnings: number
  minWins: number
  maxForfeits: number // profile.forfeits must be <= this to qualify
}

// Strict tier brackets. Ordered from entry-level to legendary.
export const TITLES: PrestigeTitle[] = [
  { id: 'rookie', vi: 'Tân Binh Hầm Ngục', en: 'Dungeon Rookie', minWinnings: 0, minWins: 0, maxForfeits: Infinity },
  {
    id: 'life-gambler',
    vi: 'Kẻ Đánh Cược Sinh Mạng',
    en: 'Life Gambler',
    minWinnings: 50_000_000,
    minWins: 1,
    maxForfeits: Infinity,
  },
  {
    id: 'mind-game-pro',
    vi: 'Bậc Thầy Đấu Trí / Mind-Game Pro',
    en: 'Mind-Game Pro',
    minWinnings: 200_000_000,
    minWins: 3,
    maxForfeits: Infinity,
  },
  {
    id: 'king-slayer',
    vi: 'Kẻ Hủy Diệt Nhà Vua',
    en: 'King Slayer',
    minWinnings: 400_000_000,
    minWins: 6,
    maxForfeits: Infinity,
  },
  {
    id: 'underground-tycoon',
    vi: 'Đại Gia Ngầm Hầm Ngục',
    en: 'Underground Tycoon',
    minWinnings: 700_000_000,
    minWins: 8,
    maxForfeits: Infinity,
  },
  {
    id: 'death-defier',
    vi: 'Kẻ Thách Thức Thần Chết / Death Defier',
    en: 'Death Defier',
    minWinnings: 1_000_000_000,
    minWins: 10,
    maxForfeits: 0,
  },
]

// Minimum lifetime winnings required to type/purchase a custom username.
export const CUSTOM_NAME_COST = 50_000_000

export function titleById(id?: string): PrestigeTitle {
  return TITLES.find((t) => t?.id === id) ?? TITLES[0]
}

export function isTitleUnlocked(title: PrestigeTitle, profile: PlayerProfile): boolean {
  return (
    (profile?.totalAccumulatedWinnings ?? 0) >= (title?.minWinnings ?? 0) &&
    (profile?.wins ?? 0) >= (title?.minWins ?? 0) &&
    (profile?.forfeits ?? 0) <= (title?.maxForfeits ?? Infinity)
  )
}

export function canUnlockCustomName(profile: PlayerProfile): boolean {
  return (profile?.totalAccumulatedWinnings ?? 0) >= CUSTOM_NAME_COST || profile.role === 'escaped'
}

export function canUnlockSpecialRole(profile: PlayerProfile): boolean {
  return (profile?.totalAccumulatedWinnings ?? 0) >= SPECIAL_ROLE_THRESHOLD
}

function coerce(raw: Partial<PlayerProfile> | null | undefined): PlayerProfile {
  const base: PlayerProfile = {
    playerName: raw?.playerName?.trim() || DEFAULT_NAME,
    currentTitleId: raw?.currentTitleId ?? DEFAULT_TITLE_ID,
    currentTitle: '',
    totalAccumulatedWinnings: Math.max(0, raw?.totalAccumulatedWinnings ?? 0),
    wins: Math.max(0, raw?.wins ?? 0),
    forfeits: Math.max(0, raw?.forfeits ?? 0),
    customNameUnlocked: Boolean(raw?.customNameUnlocked),
    role: raw?.role ?? 'none',
  }
  // Resolve the label from the id, and guard against a title the player no
  // longer qualifies for (e.g. a forfeit revoked Death Defier).
  const resolved = titleById(base.currentTitleId)
  if (!isTitleUnlocked(resolved, base)) {
    base.currentTitleId = DEFAULT_TITLE_ID
  }
  base.currentTitle = titleById(base.currentTitleId).vi
  return base
}

export function loadProfile(): PlayerProfile {
  if (typeof window === 'undefined') return coerce(null)
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY)
    if (!raw) {
      const fresh = coerce(null)
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(fresh))
      return fresh
    }
    return coerce(JSON.parse(raw) as Partial<PlayerProfile>)
  } catch {
    return coerce(null)
  }
}

export function saveProfile(profile: PlayerProfile): PlayerProfile {
  const safe = coerce(profile)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(safe))
    } catch {
      /* ignore quota errors */
    }
  }
  return safe
}

/** Merge a partial patch (name / selected title) into the stored profile. */
export function patchProfile(patch: Partial<PlayerProfile>): PlayerProfile {
  const cur = loadProfile()
  return saveProfile({ ...cur, ...patch })
}

/**
 * Apply the outcome of a finished match to lifetime economy stats, then
 * auto-promote the player to the highest prestige title they now qualify for
 * (without ever downgrading a title they manually selected and still hold).
 */
export function recordMatchOutcome(outcome: {
  winnings?: number
  wins?: number
  forfeit?: boolean
}): PlayerProfile {
  const cur = loadProfile()
  const next: PlayerProfile = {
    ...cur,
    totalAccumulatedWinnings: cur.totalAccumulatedWinnings + Math.max(0, outcome.winnings ?? 0),
    wins: cur.wins + Math.max(0, outcome.wins ?? 0),
    forfeits: cur.forfeits + (outcome.forfeit ? 1 : 0),
    customNameUnlocked:
      cur.customNameUnlocked || cur.totalAccumulatedWinnings + Math.max(0, outcome.winnings ?? 0) >= CUSTOM_NAME_COST,
  }
  // auto-promote to the best now-unlocked tier if it outranks the current one
  const currentRank = TITLES.findIndex((t) => t.id === next.currentTitleId)
  for (let i = TITLES.length - 1; i > currentRank; i -= 1) {
    if (isTitleUnlocked(TITLES[i], next)) {
      next.currentTitleId = TITLES[i].id
      break
    }
  }
  return saveProfile(next)
}
