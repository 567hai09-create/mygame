export type ChatSender = 'you' | 'hyodo' | 'system' | 'opponent'

// Single unified in-match chat model. The "Room" feed holds your own lines,
// Hyodo's taunts (AI mode), system notices, and — in real PVP — the actual
// opponent's chat relayed over the WebSocket hub. `name` is only meaningful
// for sender === 'opponent' (their display name).
export interface ChatMessage {
  id: string
  sender: ChatSender
  text: string
  name?: string
}

export interface SpeechBubble {
  id: string
  text: string
  side: 'player' | 'enemy'
}

export const QUICK_TAUNTS: { vi: string; en: string }[] = [
  { vi: 'Cược cả mạng sống đi!', en: 'Bet your life on it!' },
  { vi: 'Mày định lừa tao à? Không dễ đâu!', en: 'Think you can trick me?' },
  { vi: 'Mùi vị của kẻ thua cuộc...', en: 'Taste the despair of defeat...' },
  { vi: 'Thắng hay là chết!', en: 'Victory or the grave!' },
]

// ---- Global World Chat ("Cổng Chat Thế Giới") -------------------------
// Real, shared feed synced across every client via the WebSocket hub —
// same array is shown live in the lobby AND inside a match.
export interface GlobalChatMessage {
  id: string
  name: string
  text: string
  color: string
  timestamp: number
  self?: boolean
  clientId: string
}

export const HYODO_LINES = {
  start: { vi: 'Chào mừng đến với địa ngục của sự đặt cược...', en: 'Welcome to the hell of high stakes...' },
  stall: { vi: 'Mày đang run sợ à? Mau ra bài đi!', en: 'Are you trembling? Play your card!' },
  hyodoWin: { vi: 'Quá non nớt! Sinh mạng của mày thuộc về ta!', en: 'Pathetic child! Your life belongs to me!' },
  playerWin: { vi: 'Hừm... Chỉ là may mắn thôi. Trận chiến mới chỉ bắt đầu!', en: 'Hmph... Mere luck. The torment begins now!' },
  betRaise: { vi: 'Ta sẽ nghiền nát mày bằng số tiền này!', en: 'I will crush you with this amount!' },
  finalRound: {
    vi: 'Ván cuối cùng... Hãy để định mệnh của mày được định đoạt tại đây.',
    en: 'The final hand... Let your fate be decided right here.',
  },
}

export interface SystemBalanceWeights {
  rewardMultiplier: number
  aiAggression: number
}

export interface HardwareFingerprint {
  hash: string
  gpu: string
  cores: number
}
