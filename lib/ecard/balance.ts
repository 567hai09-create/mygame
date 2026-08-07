export const BASE_SURVIVAL_REWARD = 12_000_000
export const BASE_REWARD_PER_WIN = 18_000_000
export const BASE_DEBT_PENALTY = 8_000_000
export const BASE_PVP_MARGIN = 0.25
export const MIN_PVP_REWARD = 15_000_000

export function calculateVictoryReward(
  playerWins: number,
  multiplier = 1,
  wager = 10_000_000,
  isPvp = false,
): number {
  const normalizedWager = Math.max(10_000_000, wager)
  const base = isPvp
    ? Math.max(
        MIN_PVP_REWARD,
        Math.floor(normalizedWager * (1 + BASE_PVP_MARGIN) + playerWins * 3_000_000),
      )
    : BASE_SURVIVAL_REWARD + playerWins * BASE_REWARD_PER_WIN
  return Math.max(0, Math.floor(base * multiplier))
}

export function calculateDebtPenalty(roundWager: number, isPvp = false): number {
  const rate = isPvp ? 0.18 : 0.15
  return Math.max(BASE_DEBT_PENALTY, Math.floor(roundWager * rate))
}

export function calculateDebtReduction(currentDebt: number, critical: boolean): number {
  const factor = critical ? 0.75 : 0.9
  return Math.max(0, Math.floor(currentDebt * factor))
}
