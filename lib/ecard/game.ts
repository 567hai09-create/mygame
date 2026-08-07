// ======================================================================
// E-CARD CORE RULE ENGINE
// Emperor beats Citizen · Citizen beats Slave · Slave beats Emperor
// ======================================================================

export type CardType = 'EMPEROR' | 'SLAVE' | 'CITIZEN'
export type Faction = 'KING' | 'SLAVE'
export type ClashResult = 'PLAYER' | 'ENEMY' | 'DRAW'
export type GameMode = 'AI' | 'PVP'

export interface Card {
  id: string
  type: CardType
}

export const TOTAL_ROUNDS = 12
export const FACTION_SWAP_EVERY = 3
export const TURN_SECONDS = 60
export const MAX_SWITCHES = 3
export const START_HP = 100
export const REGULAR_LOSS_HP = 20

let cardSeq = 0
function makeCard(type: CardType): Card {
  cardSeq += 1
  return { id: `c${cardSeq}-${Math.random().toString(36).slice(2, 7)}`, type }
}

/** KING hand: 1 Emperor + 4 Citizens. SLAVE hand: 1 Slave + 4 Citizens. */
export function buildHand(faction: Faction): Card[] {
  const key: CardType = faction === 'KING' ? 'EMPEROR' : 'SLAVE'
  const hand: Card[] = [makeCard(key)]
  for (let i = 0; i < 4; i += 1) hand.push(makeCard('CITIZEN'))
  // shuffle so the special card is not always first
  for (let i = hand.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[hand[i], hand[j]] = [hand[j], hand[i]]
  }
  return hand
}

/** Faction for a given round (1-indexed). Player begins as SLAVE, the classic underdog. */
export function factionForRound(round: number, playerStartsAs: Faction): Faction {
  const segment = Math.floor((round - 1) / FACTION_SWAP_EVERY) // 0..3
  const flipped = segment % 2 === 1
  if (!flipped) return playerStartsAs
  return playerStartsAs === 'KING' ? 'SLAVE' : 'KING'
}

/** Resolve a clash between the two revealed cards. */
export function resolveClash(playerCard: CardType, enemyCard: CardType): ClashResult {
  if (playerCard === enemyCard) return 'DRAW' // citizen vs citizen (only same-type possible)
  const beats: Record<CardType, CardType> = {
    EMPEROR: 'CITIZEN',
    CITIZEN: 'SLAVE',
    SLAVE: 'EMPEROR',
  }
  if (beats[playerCard] === enemyCard) return 'PLAYER'
  if (beats[enemyCard] === playerCard) return 'ENEMY'
  return 'DRAW'
}

/** Is this a Slave-beats-Emperor upset? (the critical, instant-execution result) */
export function isCriticalUpset(playerCard: CardType, enemyCard: CardType): boolean {
  return (
    (playerCard === 'SLAVE' && enemyCard === 'EMPEROR') ||
    (playerCard === 'EMPEROR' && enemyCard === 'SLAVE')
  )
}

/**
 * Chairman Hyodo's ruthless algorithm.
 * The Slave side is desperate — it plays the trump card more aggressively.
 * Returns the index in the enemy hand to reveal.
 */
export function hyodoChooseIndex(enemyHand: Card[], enemyFaction: Faction, round: number): number {
  const trumpIdx = enemyHand.findIndex((c) => c.type !== 'CITIZEN')
  const roll = Math.random()
  // As SLAVE (only 1 in 5 chance of the trump landing), Hyodo bluffs hard, plays trump ~35%.
  // As KING, he protects the Emperor and plays citizens most of the time.
  const trumpChance = enemyFaction === 'SLAVE' ? 0.34 : 0.22
  // Escalate aggression as the match nears its end.
  const escalated = trumpChance + Math.min(0.2, round * 0.012)
  if (trumpIdx >= 0 && roll < escalated) return trumpIdx
  // otherwise pick a random citizen
  const citizenIdxs = enemyHand
    .map((c, i) => (c.type === 'CITIZEN' ? i : -1))
    .filter((i) => i >= 0)
  if (citizenIdxs.length === 0) return Math.max(0, trumpIdx)
  return citizenIdxs[Math.floor(Math.random() * citizenIdxs.length)]
}

/** Obfuscate a value so casual DOM/state inspection can't read the AI's pick. */
export function scramble(value: number): string {
  const salt = Math.floor(Math.random() * 9000) + 1000
  const encoded = (value + 7) * 31 + salt
  return `${salt.toString(36)}:${encoded.toString(36)}`
}

export function unscramble(token: string): number {
  const [saltStr, encStr] = (token ?? '').split(':')
  const salt = parseInt(saltStr ?? '0', 36)
  const enc = parseInt(encStr ?? '0', 36)
  return (enc - salt) / 31 - 7
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export function cardLabel(type: CardType): { en: string; vi: string } {
  switch (type) {
    case 'EMPEROR':
      return { en: 'Emperor', vi: 'Hoàng Đế' }
    case 'SLAVE':
      return { en: 'Slave', vi: 'Nô Lệ' }
    default:
      return { en: 'Citizen', vi: 'Bình Dân' }
  }
}
