'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type Card,
  type Faction,
  type GameMode,
  buildHand,
  factionForRound,
  hyodoChooseIndex,
  isCriticalUpset,
  resolveClash,
  scramble,
  unscramble,
  MAX_SWITCHES,
  START_HP,
  TOTAL_ROUNDS,
  TURN_SECONDS,
} from '@/lib/ecard/game'
import {
  type DamnedRecord,
  loadDungeonLock,
  loadLeaderboard,
  recordDeath,
  recordProgress,
  saveDungeonLock,
} from '@/lib/ecard/leaderboard'
import {
  type PlayerProfile,
  loadProfile,
  patchProfile,
  recordMatchOutcome,
} from '@/lib/ecard/profile'
import {
  type ActiveServer,
  loadServers,
  registerServerRoom,
  unregisterServerRoom,
} from '@/lib/ecard/servers'
import { audio } from '@/lib/ecard/audio'
import { type ChatMessage, type SpeechBubble, HYODO_LINES, type SystemBalanceWeights } from '@/components/ecard/types'
import { Lobby, type StartOpts } from '@/components/ecard/lobby'
import { Hud } from '@/components/ecard/hud'
import { Silhouette } from '@/components/ecard/silhouette'
import { PlayingCard } from '@/components/ecard/playing-card'
import { ChatDock } from '@/components/ecard/chat-dock'
import { ExecutionOverlay } from '@/components/ecard/execution-overlay'
import { VerdictOverlay } from '@/components/ecard/verdict-overlay'
import { DungeonLock } from '@/components/ecard/dungeon-lock'
import { IntroStory, hasSeenIntro } from '@/components/ecard/intro-story'
import { useAuth } from '@/lib/firebase/auth-context'
import { pullCloudProfile, pushCloudProfile, mergeProfiles } from '@/lib/ecard/cloud-sync'
import { calculateVictoryReward, calculateDebtPenalty, calculateDebtReduction } from '@/lib/ecard/balance'
import { getDungeonCooldownMs } from '@/lib/ecard/leaderboard'

type Screen = 'intro' | 'lobby' | 'game'
type Phase = 'select' | 'reveal' | 'result'
type Ending = 'victory' | 'execution' | null

const PLAYER_STARTS_AS: Faction = 'SLAVE'
const LOSS_DEBT = 100_000_000
// Set NEXT_PUBLIC_WEBSOCKET_URL once you deploy ws-server/ (see HUONG_DAN_WEBSOCKET.md).
// Falls back to the old placeholder broker, which never resolves — that's fine,
// the WebSocketNetworkEngine below degrades gracefully when it can't connect.
const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'wss://free.websocket.me/v1/kaiji-global-hub'
const RECONNECT_DELAY = 3000
const MAX_RECONNECT_ATTEMPTS = 10

let msgSeq = 0
function nextId(prefix: string) {
  msgSeq += 1
  return `${prefix}-${msgSeq}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * ============================================================================
 * HARDWARE FINGERPRINTING - ANTI-CHEAT DEFENSE
 * ============================================================================
 */
async function generateHardwareFingerprint(): Promise<{
  hash: string
  gpu: string
  cores: number
  timestamp: number
}> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { hash: 'ssr-skip', gpu: 'ssr', cores: 0, timestamp: Date.now() }
  }

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = "14px 'Arial'"
      ctx.fillStyle = '#f60'
      ctx.fillRect(125, 1, 62, 20)
      ctx.fillStyle = '#069'
      ctx.fillText('kaiji-fp-v3-ws', 2, 15)
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
      ctx.fillText('kaiji-fp-v3-ws', 4, 17)
    }

    const gl = canvas.getContext('webgl') || canvas.getContext('webgl2')
    let gpu = 'No WebGL'
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown GPU'
      } else {
        gpu = 'WebGL Enabled'
      }
    }

    const cores = navigator.hardwareConcurrency || 0
    const canvasData = canvas.toDataURL('image/png')
    const b64Slice = canvasData.slice(-100)

    let hash = 0
    for (let i = 0; i < b64Slice.length; i++) {
      const char = b64Slice.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }

    const hashStr = Math.abs(hash).toString(16).padStart(16, '0')

    return {
      hash: hashStr,
      gpu: String(gpu).substring(0, 50),
      cores,
      timestamp: Date.now(),
    }
  } catch (error) {
    console.error('Fingerprint generation error:', error)
    return { hash: 'error', gpu: 'error', cores: 0, timestamp: Date.now() }
  }
}

/**
 * ============================================================================
 * REAL-TIME WEBSOCKET NETWORK ENGINE - GLOBAL SYNC
 * ============================================================================
 * Genuine multi-client synchronization across all browsers, tabs, and incognito windows.
 * Uses public WebSocket broker for real-time chat, room directory, and wager updates.
 */
const MAX_RECONNECT_DELAY = 20_000
const HEARTBEAT_INTERVAL = 15_000
const HEARTBEAT_TIMEOUT = 8_000

class WebSocketNetworkEngine {
  private ws: WebSocket | null = null
  private url: string
  // Sets, not single callbacks — multiple parts of the UI can subscribe to
  // the same event type without silently clobbering each other's handler.
  private listeners: Map<string, Set<(data: any) => void>> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS
  private reconnectDelay = RECONNECT_DELAY
  private clientId: string
  private isConnected = false
  private closedByClient = false
  private heartbeatTimer: number | null = null
  private heartbeatTimeoutTimer: number | null = null
  private reconnectTimer: number | null = null

  constructor(url: string) {
    this.url = url
    this.clientId = `client-${Math.random().toString(36).slice(2, 9)}`
  }

  getClientId() {
    return this.clientId
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('WebSocket not available in SSR'))
        return
      }

      this.closedByClient = false

      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected to global hub')
          this.isConnected = true
          this.reconnectAttempts = 0
          this.startHeartbeat()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            const { type, payload } = message
            // A 'pong' response proves the round-trip is alive — clear the
            // watchdog that would otherwise force-close a half-dead socket.
            if (type === 'PONG') {
              this.clearHeartbeatTimeout()
              return
            }
            const handlers = this.listeners.get(type)
            handlers?.forEach((cb) => cb(payload))
          } catch (e) {
            console.error('[WebSocket] Message parse error:', e)
          }
        }

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error)
          this.isConnected = false
          reject(error)
        }

        this.ws.onclose = () => {
          this.isConnected = false
          this.stopHeartbeat()
          if (this.closedByClient) return
          console.log('[WebSocket] Connection closed, attempting reconnect...')
          this.attemptReconnect()
        }
      } catch (error) {
        console.error('[WebSocket] Connection failed:', error)
        reject(error)
      }
    })
  }

  // ---- Heartbeat: detects half-open connections (e.g. behind a proxy that
  // drops packets silently) that never fire a native 'close' event on their
  // own. Without this, a dead socket can look "connected" indefinitely. ----
  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
      try {
        this.ws.send(JSON.stringify({ type: 'PING', payload: { clientId: this.clientId, timestamp: Date.now() } }))
      } catch {
        /* send failed — let the timeout below force a reconnect */
      }
      this.heartbeatTimeoutTimer = window.setTimeout(() => {
        console.warn('[WebSocket] Heartbeat timed out — forcing reconnect')
        this.ws?.close()
      }, HEARTBEAT_TIMEOUT)
    }, HEARTBEAT_INTERVAL)
  }

  private clearHeartbeatTimeout() {
    if (this.heartbeatTimeoutTimer) {
      window.clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = null
    this.clearHeartbeatTimeout()
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    // Capped exponential backoff so a long outage settles at a sane retry
    // cadence instead of growing unbounded.
    const delay = Math.min(MAX_RECONNECT_DELAY, this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1))
    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    this.reconnectTimer = window.setTimeout(() => {
      this.connect().catch(() => {
        // Retry will be triggered by onclose
      })
    }, delay)
  }

  on(type: string, callback: (data: any) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(callback)
  }

  off(type: string, callback: (data: any) => void) {
    this.listeners.get(type)?.delete(callback)
  }

  emit(type: string, payload: any) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[WebSocket] Cannot emit ${type}: not connected`)
      return
    }

    try {
      const message = JSON.stringify({
        type,
        payload: {
          ...payload,
          clientId: this.clientId,
          timestamp: Date.now(),
        },
      })
      this.ws.send(message)
    } catch (error) {
      console.error('[WebSocket] Emit error:', error)
    }
  }

  close() {
    this.closedByClient = true
    this.stopHeartbeat()
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer)
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.isConnected = false
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected
  }
}

/**
 * ============================================================================
 * MAIN GAME COMPONENT - PRODUCTION-READY WITH REAL-TIME WEBSOCKET
 * ============================================================================
 */
export function EcardGame() {
  // ---- SSR SAFETY GATE ----
  const [mounted, setMounted] = useState(false)

  // ---- top-level state ----
  const [screen, setScreen] = useState<Screen>('lobby')
  const [mode, setMode] = useState<GameMode>('AI')
  const [name, setName] = useState('Kẻ Vô Danh')
  const [roomCode, setRoomCode] = useState<string | undefined>(undefined)
  const [leaderboard, setLeaderboard] = useState<DamnedRecord[]>([])
  const [muted, setMuted] = useState(false)

  // ---- hardware defense ----
  const [cheatDetected, setCheatDetected] = useState(false)

  // ---- persistent identity ----
  const [profile, setProfile] = useState<PlayerProfile>(() => ({
    playerName: 'Kẻ Vô Danh / Anonymous',
    currentTitle: '',
    currentTitleId: 'rookie',
    totalAccumulatedWinnings: 0,
    wins: 0,
    forfeits: 0,
    customNameUnlocked: false,
    role: 'none',
  }))
  const [servers, setServers] = useState<ActiveServer[]>([])
  const [fingerprint, setFingerprint] = useState<string>('')

  useEffect(() => {
    generateHardwareFingerprint().then((fp) => {
      setFingerprint(fp.hash)
    })
  }, [])

  const getDisplayName = useCallback((prof: PlayerProfile) => {
    if (prof.role === 'admin') return 'Kẻ Vô Danh'
    if (prof.role === 'escaped') return prof.playerName
    if (prof.playerName !== 'Kẻ Vô Danh' && prof.playerName !== 'Kẻ Vô Danh / Anonymous') return prof.playerName
    
    // Anonymous number based on fingerprint
    const num = fingerprint ? parseInt(fingerprint.slice(-3), 16) % 1000 : '?'
    return `Kẻ Vô Danh #${num}`
  }, [fingerprint])

  const displayName = useMemo(() => getDisplayName(profile), [profile, getDisplayName])
  const [verdict, setVerdict] = useState<'despair' | 'survived' | null>(null)

  // ---- cloud sync (Firebase Auth + Firestore) ----
  const { user } = useAuth()
  const cloudPulledForUidRef = useRef<string | null>(null)
  const cloudSkipNextPushRef = useRef(false)
  const cloudPushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // On sign-in: pull the cloud profile once per uid and merge it into the
  // local one (never regressing winnings/wins), then persist the merge.
  useEffect(() => {
    if (!mounted || !user) return
    if (cloudPulledForUidRef.current === user.uid) return
    cloudPulledForUidRef.current = user.uid

    pullCloudProfile(user.uid)
      .then((cloud) => {
        if (!cloud) {
          // Nothing in the cloud yet for this account — seed it from local.
          pushCloudProfile(user.uid, profile).catch((err) => console.error('Cloud profile push failed:', err))
          return
        }
        const merged = mergeProfiles(profile, cloud)
        cloudSkipNextPushRef.current = true // this setProfile is a pull result, not a local change to push back
        setProfile(patchProfile(merged))
      })
      .catch((err) => console.error('Cloud profile pull failed:', err))
    // profile intentionally omitted: this effect should only re-run on login, not on every profile change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, user])

  // Debounced push: whenever the local profile changes while signed in, mirror it to Firestore.
  useEffect(() => {
    if (!mounted || !user) return
    if (cloudSkipNextPushRef.current) {
      cloudSkipNextPushRef.current = false
      return
    }
    if (cloudPushTimerRef.current) clearTimeout(cloudPushTimerRef.current)
    cloudPushTimerRef.current = setTimeout(() => {
      pushCloudProfile(user.uid, profile).catch((err) => console.error('Cloud profile push failed:', err))
    }, 1500)
    return () => {
      if (cloudPushTimerRef.current) clearTimeout(cloudPushTimerRef.current)
    }
  }, [mounted, user, profile])

  // ---- match state ----
  const [round, setRound] = useState(1)
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [enemyHand, setEnemyHand] = useState<Card[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [switches, setSwitches] = useState(0)
  const [phase, setPhase] = useState<Phase>('select')
  const [revealedPlayer, setRevealedPlayer] = useState<Card | null>(null)
  const [revealedEnemy, setRevealedEnemy] = useState<Card | null>(null)
  const [resultText, setResultText] = useState('')

  const [playerHP, setPlayerHP] = useState(START_HP)
  const [enemyHP, setEnemyHP] = useState(START_HP)
  const [playerWins, setPlayerWins] = useState(0)
  const [enemyWins, setEnemyWins] = useState(0)
  const [drillProgress, setDrillProgress] = useState(0)
  const [currentDebt, setCurrentDebt] = useState(0)

  // ---- wager system ----
  const [roundWager, setRoundWager] = useState(10_000_000)
  const [isLifeWagerActive, setIsLifeWagerActive] = useState(false)
  const [wagerLocked, setWagerLocked] = useState(false)
  const [opponentWagerNotification, setOpponentWagerNotification] = useState('')
  const [balance, setBalance] = useState<SystemBalanceWeights>({ rewardMultiplier: 1, aiAggression: 0 })

  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS)
  const [bpm, setBpm] = useState(70)

  // ---- fx / overlays ----
  const [bubbles, setBubbles] = useState<SpeechBubble[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [globalChatMessages, setGlobalChatMessages] = useState<Array<{
    id: string
    name: string
    text: string
    color: string
    timestamp: number
    self?: boolean
  }>>([])
  const [inputActive, setInputActive] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [split, setSplit] = useState(false)
  const [monochrome, setMonochrome] = useState(false)
  /** Brief intense CRT glitch burst played once, right when a match kicks off. */
  const [matchEnterGlitch, setMatchEnterGlitch] = useState(false)
  const [shake, setShake] = useState(false)
  const [playerHit, setPlayerHit] = useState(false)
  const [enemyHit, setEnemyHit] = useState(false)
  const [ending, setEnding] = useState<Ending>(null)

  const [dungeonLocked, setDungeonLocked] = useState(false)
  const [dungeonSeconds, setDungeonSeconds] = useState(0)
  const [aiLockSeconds, setAiLockSeconds] = useState(0)
  const [wsConnected, setWsConnected] = useState(false)

  // ---- REAL PVP state (peer-to-peer over the WebSocket relay — no bot) ----
  // Host = the person who opened the table; Guest = the challenger who
  // walked in. Each side deals only its OWN hand locally (never transmits
  // full hands — keeps picks genuinely hidden) and only the chosen card
  // TYPE crosses the wire once a player locks in.
  const [pvpRole, setPvpRole] = useState<'host' | 'guest' | null>(null)
  const [opponentName, setOpponentName] = useState('')
  const [pvpWaiting, setPvpWaiting] = useState(false) // host: table open, no challenger yet
  const [pvpAwaitingOpponent, setPvpAwaitingOpponent] = useState(false) // both mid-match: I picked, they haven't (yet)
  const [pvpRoomStake, setPvpRoomStake] = useState<number | null>(null)

  // ---- refs ----
  const enemyPickRef = useRef<string>('')
  const timeoutsRef = useRef<number[]>([])
  const intervalsRef = useRef<number[]>([])
  const rafRef = useRef<number | null>(null)
  const stallTauntedRef = useRef(false)
  const hostedRoomRef = useRef<string | undefined>(undefined)
  const wsRef = useRef<WebSocketNetworkEngine | null>(null)
  const modeRef = useRef<GameMode>('AI')
  const pvpRoleRef = useRef<'host' | 'guest' | null>(null)
  const pvpOpponentPickRef = useRef<{ round: number; cardType: Card['type'] } | null>(null)
  const pvpMyPickSentRoundRef = useRef<number>(0)
  const roomCodeRef = useRef<string | undefined>(undefined)
  const screenRef = useRef<Screen>('lobby')

  useEffect(() => { roomCodeRef.current = roomCode }, [roomCode])
  useEffect(() => { screenRef.current = screen }, [screen])

  // The faction *I* start the match as. In real PVP the guest is always the
  // mirror of the host so the two sides are never on the same side.
  const localStartFaction: Faction =
    mode === 'PVP' && pvpRole === 'guest' ? (PLAYER_STARTS_AS === 'KING' ? 'SLAVE' : 'KING') : PLAYER_STARTS_AS
  const faction = factionForRound(round, localStartFaction)
  const enemyFaction: Faction = faction === 'KING' ? 'SLAVE' : 'KING'

  // ---- utility functions ----
  const AI_LOCK_KEY = 'ai_loss_lock_until_v1'
  const AI_LOCK_DURATION_MS = 30 * 1000

  const setAiLock = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      const until = Date.now() + AI_LOCK_DURATION_MS
      window.localStorage.setItem(AI_LOCK_KEY, String(until))
      setAiLockSeconds(Math.ceil(AI_LOCK_DURATION_MS / 1000))
      const id = window.setInterval(() => {
        setAiLockSeconds((s) => {
          if (s <= 1) {
            window.clearInterval(id)
            return 0
          }
          return s - 1
        })
      }, 1000)
      intervalsRef.current.push(id)
    } catch (err) {
      // ignore storage errors
    }
  }, [])

  const getAiLockRemainingMs = useCallback(() => {
    if (typeof window === 'undefined') return 0
    try {
      const v = window.localStorage.getItem(AI_LOCK_KEY)
      if (!v) return 0
      const until = parseInt(v, 10)
      const rem = until - Date.now()
      return rem > 0 ? rem : 0
    } catch (err) {
      return 0
    }
  }, [])

  const later = useCallback((fn: () => void, ms: number) => {
    if (typeof window === 'undefined') return 0
    const id = window.setTimeout(fn, ms)
    timeoutsRef.current.push(id)
    return id
  }, [])

  // Ask global hub for AI match approval (server-enforced lock)
  const requestAiApproval = useCallback((): Promise<{ allowed: boolean; remainingMs?: number }>
    => {
    return new Promise((resolve) => {
      const engine = wsRef.current
      if (!engine || !engine.getConnectionStatus()) return resolve({ allowed: true })

      let settled = false
      function onApproved(_data: any) {
        if (settled) return
        settled = true
        engine.off('AI_MATCH_APPROVED', onApproved)
        engine.off('AI_MATCH_REJECTED', onRejected)
        resolve({ allowed: true })
      }
      function onRejected(data: any) {
        if (settled) return
        settled = true
        engine.off('AI_MATCH_APPROVED', onApproved)
        engine.off('AI_MATCH_REJECTED', onRejected)
        resolve({ allowed: false, remainingMs: data?.remainingMs ?? 0 })
      }

      engine.on('AI_MATCH_APPROVED', onApproved)
      engine.on('AI_MATCH_REJECTED', onRejected)

      // Emit request (engine will attach clientId/timestamp)
      engine.emit('AI_MATCH_REQUEST', { fingerprint })

      // Fallback timeout: treat as allowed if no response in 2s
      const to = window.setTimeout(() => {
        if (settled) return
        settled = true
        engine.off('AI_MATCH_APPROVED', onApproved)
        engine.off('AI_MATCH_REJECTED', onRejected)
        resolve({ allowed: true })
      }, 2000)
      timeoutsRef.current.push(to)
    })
  }, [fingerprint])

  const clearTimers = useCallback(() => {
    if (typeof window === 'undefined') return
    timeoutsRef.current.forEach((id) => window.clearTimeout(id))
    timeoutsRef.current = []
    intervalsRef.current.forEach((id) => window.clearInterval(id))
    intervalsRef.current = []
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  // ---- chat / bubbles ----
  // Every local match message now lives in ONE feed (the "Room" tab) — your
  // own lines, Hyodo's taunts (AI), system notices, and the real opponent's
  // chat relayed over the WebSocket hub in PVP.
  const addMessage = useCallback((sender: ChatMessage['sender'], text: string, name?: string) => {
    setMessages((prev) => [...prev, { id: nextId('m'), sender, text, name }])
  }, [])

  const addBubble = useCallback(
    (side: SpeechBubble['side'], text: string) => {
      const id = nextId('b')
      setBubbles((prev) => [...prev, { id, text, side }])
      setShake(true)
      later(() => setShake(false), 400)
      later(() => setBubbles((prev) => prev.filter((b) => b.id !== id)), 2500)
    },
    [later],
  )

  const hyodoTaunt = useCallback(
    (line: { vi: string; en: string }) => {
      addMessage('hyodo', line.vi)
      addBubble('enemy', line.vi)
    },
    [addMessage, addBubble],
  )

  // ---- REAL world chat (single shared feed, lobby + live in-match) ----
  const onWorldChatSend = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      setGlobalChatMessages((prev) => [
        ...prev.slice(-50),
        { 
          id: nextId('gc'), 
          name: displayName, 
          text: trimmed, 
          color: profile.role === 'admin' ? '#ef4444' : profile.role === 'escaped' ? '#10b981' : '#b3914a', 
          timestamp: Date.now(), 
          self: true,
          clientId: wsRef.current?.getClientId() || ''
        },
      ])
      wsRef.current?.emit('GLOBAL_CHAT_MESSAGE', {
        playerName: displayName,
        text: trimmed,
        color: profile.role === 'admin' ? '#ef4444' : profile.role === 'escaped' ? '#10b981' : '#b3914a',
        role: profile.role,
        fingerprint,
      })
    },
    [displayName, profile.role, fingerprint],
  )

  const onMutePlayer = useCallback((clientId: string) => {
    if (profile.role !== 'admin') return
    window.localStorage.setItem(`muted-${clientId}`, 'true')
    setMessages((prev) => [
      ...prev,
      { id: nextId('sys'), sender: 'system', text: 'Đã khóa chat người chơi này.' }
    ])
  }, [profile.role])

  const onInvitePlayer = useCallback((targetName: string) => {
    if (profile.role !== 'admin') return
    onWorldChatSend(`[INVITE] Mời ${targetName} tham gia bàn cược của tôi!`)
  }, [profile.role, onWorldChatSend])

  // ---- REAL PVP room chat (your own line +, in PVP, relayed to the opponent) ----
  const sendRoomChat = useCallback(
    (text: string) => {
      addMessage('you', text)
      if (modeRef.current === 'PVP' && roomCode) {
        wsRef.current?.emit('ROOM_CHAT_MESSAGE', { roomCode, name, text })
      }
    },
    [addMessage, roomCode, name],
  )

  // ---- WEBSOCKET INITIALIZATION ----
  useEffect(() => {
    setMounted(true)
    if (typeof window === 'undefined') return

    if (!hasSeenIntro()) setScreen('intro')

    // Initialize WebSocket network engine
    wsRef.current = new WebSocketNetworkEngine(WEBSOCKET_URL)

    wsRef.current.connect().then(() => {
      setWsConnected(true)

      // Sync existing rooms from server
      wsRef.current?.on('SYNC_ROOMS', (data) => {
        if (data.rooms && Array.isArray(data.rooms)) {
          setServers(data.rooms)
        }
      })

      // Listen for global chat messages
      wsRef.current?.on('GLOBAL_CHAT_MESSAGE', (data) => {
        // Check if player is muted locally
        if (window.localStorage.getItem(`muted-${data.clientId}`)) return

        setGlobalChatMessages((prev) => [
          ...prev.slice(-50),
          {
            id: nextId('gc'),
            name: data.playerName ?? 'Kẻ Vô Danh',
            text: data.text,
            color: data.color ?? '#7dd3fc',
            timestamp: data.timestamp,
          },
        ])
      })

      // Listen for room creation events
      wsRef.current?.on('ROOM_CREATED', (data) => {
        const newRoom: ActiveServer = {
          id: data.roomCode,
          hostName: data.hostName,
          wager: data.wager,
          faction: data.faction,
          isPrivate: data.isPrivate,
          status: 'WAITING',
          createdAt: data.timestamp,
        }
        setServers((prev) => {
          const existingIndex = prev.findIndex((room) => room.id === newRoom.id)
          if (existingIndex >= 0) {
            const next = [...prev]
            next[existingIndex] = { ...next[existingIndex], ...newRoom }
            return next
          }
          return [...prev, newRoom]
        })
      })

      // Listen for room destruction events
      wsRef.current?.on('ROOM_DESTROYED', (data) => {
        setServers((prev) => prev.filter((r) => r.id !== data.roomCode))
        // If it's OUR active PVP match's room and we're mid-fight, the
        // opponent just left (surrendered / closed the tab).
        if (
          modeRef.current === 'PVP' &&
          roomCodeRef.current &&
          data.roomCode === roomCodeRef.current &&
          screenRef.current === 'game'
        ) {
          addMessage('system', 'Đối thủ đã rời trận đấu.')
        }
      })

      // Listen for the opponent's real chat inside a PVP room, filtered to
      // OUR active room so we never see chat from unrelated tables.
      wsRef.current?.on('ROOM_CHAT_MESSAGE', (data) => {
        if (!roomCodeRef.current || data.roomCode !== roomCodeRef.current) return
        addMessage('opponent', data.text, data.name)
      })

      // NOTE: the opponent's real card-pick listener ('PVP_CARD_PICK') is
      // registered in its own effect further down (needs fresh round/hand
      // state each round to resolve the clash the instant both picks land).

      // Listen for room-full/lock events — the moment a challenger takes the
      // seat, every other client marks that table INGAME so it disappears
      // from "BÀN CƯỢC ĐANG TRỐNG" and can't be double-joined.
      wsRef.current?.on('ROOM_JOINED', (data) => {
        setServers((prev) => prev.map((r) => (r.id === data.roomCode ? { ...r, status: 'INGAME' as const } : r)))
      })

      // Listen for wager updates
      wsRef.current?.on('ROUND_WAGER_UPDATE', (data) => {
        if (data.playerName !== name) {
          setOpponentWagerNotification(`ĐỐI THỦ ĐANG TỐ THÊM: 🪙 ${data.wager.toLocaleString()} COIN!`)
          later(() => setOpponentWagerNotification(''), 3000)
        }
      })
    }).catch((error) => {
      console.error('WebSocket connection failed:', error)
      setWsConnected(false)
    })

    // Load persistent state
    setLeaderboard(loadLeaderboard())
    const p = loadProfile()
    setProfile(p)
    setName(p.playerName?.split(' / ')[0] ?? 'Kẻ Vô Danh')
    setServers(loadServers())

    // Generate hardware fingerprint
    generateHardwareFingerprint().then((fp) => {
      setFingerprint(fp.hash)
      if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
        const stored = sessionStorage.getItem('kaiji-fp')
        if (stored && stored !== fp.hash) {
          setCheatDetected(true)
        } else {
          sessionStorage.setItem('kaiji-fp', fp.hash)
        }
      }
    })

    // Load dungeon lock
    const lock = loadDungeonLock()
    if (lock) {
      const secs = Math.ceil((lock.until - Date.now()) / 1000)
      if (secs > 0) {
        setDungeonLocked(true)
        setDungeonSeconds(secs)
      }
    }

    // Cleanup on unmount
    const onUnload = () => {
      if (hostedRoomRef.current) {
        const roomCodeToRemove = hostedRoomRef.current
        unregisterServerRoom(roomCodeToRemove)
        // Broadcast room destruction
        wsRef.current?.emit('ROOM_DESTROYED', {
          roomCode: roomCodeToRemove,
          hostName: name,
        })
      }
      if (wsRef.current) wsRef.current.close()
    }
    window.addEventListener('beforeunload', onUnload)

    return () => {
      window.removeEventListener('beforeunload', onUnload)
      clearTimers()
      if (hostedRoomRef.current) {
        const roomCodeToRemove = hostedRoomRef.current
        unregisterServerRoom(roomCodeToRemove)
        wsRef.current?.emit('ROOM_DESTROYED', {
          roomCode: roomCodeToRemove,
          hostName: name,
        })
      }
      if (wsRef.current) wsRef.current.close()
      audio.teardown()
    }
  }, [clearTimers, name, later])

  // ---- AUDIO HEARTBEAT SYNC ----
  useEffect(() => {
    if (!mounted) return
    if (screen === 'game' && !ending) {
      audio.ensure()
      audio.setHeartRate(bpm)
    } else {
      audio.stopHeart()
    }
  }, [bpm, screen, ending, mounted])

  useEffect(() => {
    if (!mounted) return
    if (screen === 'game' && !ending && !executing && phase === 'select' && !pvpAwaitingOpponent) {
      audio.startClockTick()
    } else {
      audio.stopClockTick()
    }
  }, [screen, ending, executing, phase, pvpAwaitingOpponent, mounted])

  useEffect(() => {
    if (!mounted) return
    const shouldManageBreathing = screen === 'game' && phase !== 'result' && !ending && !executing && !split
    const lowHp = playerHP <= 30 || enemyHP <= 30

    if (shouldManageBreathing && lowHp) {
      const intensity = 0.16 + (30 - Math.min(playerHP, enemyHP)) / 30 * 0.16
      audio.startBreathing(Math.max(0.16, Math.min(0.38, intensity)))
    } else if (shouldManageBreathing) {
      audio.stopBreathing()
    }
  }, [screen, phase, ending, executing, split, playerHP, enemyHP, mounted])

  useEffect(() => {
    if (mounted) audio.setMuted(muted)
  }, [muted, mounted])

  // ---- SELF-BALANCING MATRIX ----
  const recalibrateBalance = useCallback(() => {
    let multiplier = 1
    let aggression = 0

    if (playerHP < 30 || currentDebt > 500_000_000) {
      multiplier = 1.5
    }

    if (playerWins > 2 && mode === 'AI') {
      aggression = 0.45
    }

    setBalance({ rewardMultiplier: multiplier, aiAggression: aggression })
  }, [playerHP, currentDebt, playerWins, mode])

  // ---- ROUND LIFECYCLE ----
  const startRound = useCallback(
    (r: number) => {
      recalibrateBalance()
      const iAmPvpGuest = modeRef.current === 'PVP' && pvpRoleRef.current === 'guest'
      const myStartFaction: Faction = iAmPvpGuest ? (PLAYER_STARTS_AS === 'KING' ? 'SLAVE' : 'KING') : PLAYER_STARTS_AS
      const f = factionForRound(r, myStartFaction)
      const ef: Faction = f === 'KING' ? 'SLAVE' : 'KING'
      const pHand = buildHand(f)
      // In real PVP the enemy hand is only ever used for its card-back
      // visuals — the actual outcome is decided by the network pick.
      const eHand = modeRef.current === 'PVP' ? buildHand(ef) : buildHand(ef)
      if (modeRef.current !== 'PVP') {
        const pick = hyodoChooseIndex(eHand, ef, r)
        enemyPickRef.current = scramble(pick)
      }
      pvpOpponentPickRef.current = null
      pvpMyPickSentRoundRef.current = 0
      setPvpAwaitingOpponent(false)

      setPlayerHand(pHand)
      setEnemyHand(eHand)
      setSelectedIndex(null)
      setSwitches(0)
      setRevealedPlayer(null)
      setRevealedEnemy(null)
      setResultText('')
      setPhase('select')
      setTimeLeft(TURN_SECONDS)
      setBpm(70)
      stallTauntedRef.current = false
      setWagerLocked(false)

      // Cosmetic-only cue: last round of the match gets a heavier atmosphere.
      // Does not touch scoring, timers, or win/loss logic.
      if (mode === 'AI' && r >= TOTAL_ROUNDS) {
        later(() => hyodoTaunt(HYODO_LINES.finalRound), 500)
      }

      // Mock Hyodo Bluffing (AI mode only — never against a real PVP opponent)
      if (mode === 'AI' && enemyHP < playerHP && Math.random() < balance.aiAggression) {
        later(() => {
          const newWager = Math.floor((roundWager ?? 10_000_000) * 3)
          setRoundWager(newWager)
          hyodoTaunt(HYODO_LINES.betRaise)
        }, 1500)
      }
    },
    [recalibrateBalance, mode, enemyHP, playerHP, balance.aiAggression, hyodoTaunt, later, roundWager],
  )

  // Shared "reset stats & actually begin playing round 1" tail — used both
  // by a normal match start (AI, or PVP guest joining) and by the host the
  // moment a real challenger takes the seat at their table.
  const enterMatch = useCallback(() => {
    clearTimers()
    setRound(1)
    setPlayerHP(START_HP)
    setEnemyHP(START_HP)
    setPlayerWins(0)
    setEnemyWins(0)
    setDrillProgress(0)
    setCurrentDebt(0)
    setEnding(null)
    setExecuting(false)
    setSplit(false)
    setMonochrome(false)
    setMessages([])
    setBubbles([])
    setResultText('')
    setSelectedIndex(null)
    setPhase('select')
    setVerdict(null)
    setPvpAwaitingOpponent(false)
    setOpponentWagerNotification('')
    setScreen('game')
    startRound(1)
  }, [clearTimers, startRound])

  const startMatch = useCallback(
    (m: GameMode, opts: StartOpts) => {
      // Prevent starting AI matches while locked after recent loss (client-side)
      if (m === 'AI') {
        const rem = getAiLockRemainingMs()
        if (rem > 0) {
          addMessage('system', `Bạn đang bị khóa sau khi thua bot. Vui lòng đợi ${Math.ceil(rem / 1000)} giây.`)
          return
        }
        // Also request server approval (server may enforce global locks)
        requestAiApproval().then((res) => {
          if (!res.allowed) {
            addMessage('system', `Bạn đang bị khóa trên server. Vui lòng đợi ${Math.ceil((res.remainingMs ?? 0) / 1000)} giây.`)
            return
          }
          // server allowed: continue starting match
          startMatch(m, opts)
        })
        return
      }
      audio.ensure()
      audio.playMatchIntroStinger()
      setMatchEnterGlitch(true)
      later(() => setMatchEnterGlitch(false), 650)
      clearTimers()
      modeRef.current = m
      setMode(m)
      setName(opts.name ?? 'Kẻ Vô Danh')
      setRoomCode(opts.roomCode)
      setIsLifeWagerActive(false)
      setRoundWager(opts.wager ?? 10_000_000)

      if (m === 'PVP' && opts.host && opts.roomCode) {
        // Host opens the table and genuinely WAITS — no bot, no local game
        // starts yet. It stays visible/joinable in the shared directory
        // until exactly one real challenger takes the seat.
        const stake = opts.wager ?? 10_000_000
        pvpRoleRef.current = 'host'
        setPvpRole('host')
        setOpponentName('')
        hostedRoomRef.current = opts.roomCode
        setPvpRoomStake(stake)
        setRoundWager(stake)
        const updated = registerServerRoom({
          id: opts.roomCode,
          hostName: opts.name ?? 'Kẻ Vô Danh',
          wager: stake,
          faction: PLAYER_STARTS_AS,
          isPrivate: Boolean(opts.isPrivate),
          status: 'WAITING',
          createdAt: Date.now(),
        })
        setServers(updated)

        // Broadcast room creation via WebSocket
        wsRef.current?.emit('ROOM_CREATED', {
          roomCode: opts.roomCode,
          hostName: opts.name ?? 'Kẻ Vô Danh',
          wager: stake,
          faction: PLAYER_STARTS_AS,
          isPrivate: Boolean(opts.isPrivate),
        })
        setPvpWaiting(true)
        return // do NOT enter the game screen yet — wait for ROOM_JOINED
      } else if (m === 'PVP' && !opts.host && opts.roomCode) {
        // Prevent a host from joining their own room as if they were a guest.
        if (pvpRoleRef.current === 'host' && hostedRoomRef.current === opts.roomCode) {
          setPvpWaiting(false)
          setPvpRole(null)
          pvpRoleRef.current = null
          setRoomCode(undefined)
          setScreen('lobby')
          return
        }

        // A challenger just took the seat — the table is now full. Lock it
        // immediately in the shared directory so nobody else can pile in,
        // and tell every other open tab/client (including the host) to do
        // the same and learn who just walked in.
        pvpRoleRef.current = 'guest'
        setPvpRole('guest')
        const existing = loadServers().find((s) => s.id === opts.roomCode)
        setOpponentName(existing?.hostName ?? 'Đối Thủ')
        const stake = existing?.wager ?? opts.wager ?? 10_000_000
        setPvpRoomStake(stake)
        setRoundWager(stake)
        const updated = registerServerRoom({
          id: opts.roomCode,
          hostName: existing?.hostName ?? 'Kẻ Vô Danh',
          wager: existing?.wager ?? opts.wager ?? LOSS_DEBT,
          faction: existing?.faction ?? PLAYER_STARTS_AS,
          isPrivate: existing?.isPrivate ?? false,
          status: 'INGAME',
          createdAt: existing?.createdAt ?? Date.now(),
        })
        setServers(updated)
        setRoundWager(stake)
        wsRef.current?.emit('ROOM_JOINED', {
          roomCode: opts.roomCode,
          challengerName: opts.name ?? 'Kẻ Vô Danh',
        })
      } else {
        // AI solo mode — no PVP role, no bot-generated opponent identity.
        pvpRoleRef.current = null
        setPvpRole(null)
        setOpponentName('')
      }

      enterMatch()
      if (m === 'AI') later(() => hyodoTaunt(HYODO_LINES.start), 700)
    },
    [clearTimers, later, hyodoTaunt, servers, enterMatch, getAiLockRemainingMs, addMessage, requestAiApproval],
  )

  // ---- Host side: fires the instant a real challenger joins our table ----
  useEffect(() => {
    if (!wsRef.current) return
    const engine = wsRef.current
    function onRoomJoined(data: any) {
      if (pvpRoleRef.current !== 'host') return
      if (!hostedRoomRef.current || data.roomCode !== hostedRoomRef.current) return
      setOpponentName(data.challengerName ?? 'Đối Thủ')
      setPvpWaiting(false)
      audio.ensure()
      audio.playMatchIntroStinger()
      enterMatch()
    }
    engine.on('ROOM_JOINED', onRoomJoined)
    return () => engine.off('ROOM_JOINED', onRoomJoined)
  }, [wsConnected, enterMatch])

  const resetPvpSession = useCallback(() => {
    setPvpWaiting(false)
    setPvpAwaitingOpponent(false)
    pvpRoleRef.current = null
    setPvpRole(null)
    setOpponentName('')
    setRoomCode(undefined)
    setPvpRoomStake(null)
    setExecuting(false)
    setSplit(false)
    setMonochrome(false)
    setVerdict(null)
    setEnding(null)
    hostedRoomRef.current = undefined
  }, [])

  const cancelPvpWaiting = useCallback(() => {
    audio.click()
    if (hostedRoomRef.current) {
      const roomCodeToRemove = hostedRoomRef.current
      unregisterServerRoom(roomCodeToRemove)
      wsRef.current?.emit('ROOM_DESTROYED', { roomCode: roomCodeToRemove, hostName: name })
      setServers((prev) => prev.filter((server) => server.id !== roomCodeToRemove))
    }
    resetPvpSession()
    setScreen('lobby')
  }, [name, resetPvpSession])

  // ---- ULTIMATE LIFE-WAGER ----
  const activateLifeWager = useCallback(() => {
    if (phase !== 'select' || isLifeWagerActive) return
    audio.explosion()
    setIsLifeWagerActive(true)
    setWagerLocked(true)
    const totalAssets = 10_000_000
    setRoundWager(totalAssets)
    addMessage('system', 'ULTIMATE LIFE-WAGER KÍCH HOẠT: THẮNG LÀM VUA, THUA LÀM MA!')

    // Broadcast via WebSocket
    wsRef.current?.emit('LIFE_WAGER_ACTIVATED', {
      playerName: name,
      wager: totalAssets,
    })
  }, [phase, isLifeWagerActive, currentDebt, addMessage, name])

  const onProfileNameChange = useCallback((newName: string) => {
    setProfile((p) => patchProfile({ ...p, playerName: newName }))
  }, [])

  const onSaveProfile = useCallback((patch: { playerName?: string; currentTitleId?: string }) => {
    setProfile((p) => patchProfile({ ...p, ...patch }))
  }, [])

  const selectCard = useCallback(
    (i: number) => {
      if (phase !== 'select' || executing || pvpAwaitingOpponent) return
      if (selectedIndex === null) {
        setSelectedIndex(i)
        audio.select()
        return
      }
      if (i === selectedIndex) return
      if (switches >= MAX_SWITCHES) return
      setSwitches((s) => s + 1)
      setSelectedIndex(i)
      audio.select()
      if (switches + 1 >= 2) setBpm(160)
    },
    [phase, executing, selectedIndex, switches, pvpAwaitingOpponent],
  )

  // ---- EXECUTION FINISHER ----
  const triggerExecution = useCallback(() => {
    clearTimers()
    setPhase('result')
    setExecuting(true)
    setSplit(true)
    setShake(true)
    setVerdict(null)
    setEnding(null)
    audio.stopClockTick()
    audio.explosion()
    audio.drill()
    audio.stopHeart()
    audio.deathBell()
    audio.startDirge()
    audio.startBreathing(0.85)
    later(() => setShake(false), 600)
    later(() => setMonochrome(true), 900)

    const updated = recordDeath(displayName, { debt: currentDebt + LOSS_DEBT, wins: playerWins, fingerprint, role: profile.role })
    setLeaderboard(updated)
    setProfile(recordMatchOutcome({ wins: playerWins }))
    if (roomCode) {
      wsRef.current?.emit('ROOM_DESTROYED', {
        roomCode,
        hostName: displayName,
      })
    }
    if (hostedRoomRef.current) {
      const roomCodeToRemove = hostedRoomRef.current
      setServers(unregisterServerRoom(roomCodeToRemove))
      hostedRoomRef.current = undefined
    }
    resetPvpSession()
    // If this was an AI match, apply a temporary lock to prevent immediate rematch
    try {
      if (modeRef.current === 'AI') {
        setAiLock()
        try {
          wsRef.current?.emit('AI_MATCH_LOSS', { fingerprint })
        } catch (err) {
          // ignore
        }
      }
    } catch (err) {
      // ignore
    }
    later(() => {
      audio.stopBreathing()
      audio.stopDirge()
      setVerdict('despair')
    }, 3400)
  }, [clearTimers, later, currentDebt, playerWins, resetPvpSession, roomCode, displayName, setAiLock])

  const triggerVictory = useCallback(() => {
    clearTimers()
    setPhase('result')
    setVerdict(null)
    setEnding(null)
    audio.stopClockTick()
    audio.stopDirge()
    audio.win()
    audio.breathingBurst(0.7, 5)
    const winnings = calculateVictoryReward(
      playerWins + 1,
      balance?.rewardMultiplier ?? 1,
      mode === 'PVP' ? pvpRoomStake ?? roundWager ?? 10_000_000 : 10_000_000,
      mode === 'PVP',
    )
    const updated = recordProgress(displayName, { wins: playerWins + 1, debt: 0, fingerprint, role: profile.role })
    setLeaderboard(updated)
    setProfile(recordMatchOutcome({ wins: playerWins + 1, winnings }))
    if (hostedRoomRef.current) {
      const roomCodeToRemove = hostedRoomRef.current
      setServers(unregisterServerRoom(roomCodeToRemove))
      wsRef.current?.emit('ROOM_DESTROYED', {
        roomCode: roomCodeToRemove,
        hostName: displayName,
      })
      hostedRoomRef.current = undefined
    }
    resetPvpSession()
    later(() => setVerdict('survived'), 600)
  }, [clearTimers, later, displayName, playerWins, balance?.rewardMultiplier, pvpRoomStake, roundWager, mode, resetPvpSession])

  // ---- REVEAL + RESOLVE ----
  // `isPvp` distinguishes a genuine real-PVP round (both sides always
  // submitted an actual card, even a rushed/random one on timeout — so the
  // clash always resolves normally) from the AI mode's "you stalled, you
  // lose" forced-timeout rule.
  const finishRound = useCallback(
    (pCard: Card, eCard: Card, forced: boolean, isPvp: boolean) => {
      setRevealedPlayer(pCard)
      setRevealedEnemy(eCard)
      setPhase('reveal')
      setPvpAwaitingOpponent(false)
      audio.reveal()

      later(() => {
        const hardForcedLoss = forced && !isPvp
        const result = hardForcedLoss ? 'ENEMY' : resolveClash(pCard.type, eCard.type)
        const critical = hardForcedLoss || isCriticalUpset(pCard.type, eCard.type)

        let nextPlayerHP = playerHP
        let nextEnemyHP = enemyHP
        let nextDrill = drillProgress
        let text = ''

        if (result === 'PLAYER') {
          const dmg = critical ? START_HP : 20
          nextEnemyHP = Math.max(0, enemyHP - dmg)
          setEnemyHP(nextEnemyHP)
          setPlayerWins((w) => w + 1)
          audio.hitDamage(critical)
          setEnemyHit(true)
          later(() => setEnemyHit(false), 380)

          if (isLifeWagerActive) {
            setCurrentDebt(0)
            text = 'ULTIMATE SURVIVAL! Mọi nợ nần đã được xóa bỏ!'
          } else {
            setCurrentDebt((d) => calculateDebtReduction(d, critical))
            text = critical ? 'CRITICAL WIN! Nợ nần giảm 50%!' : 'You win the exchange.'
          }

          audio.win()
          if (mode === 'AI') later(() => hyodoTaunt(HYODO_LINES.playerWin), 400)
        } else if (result === 'ENEMY') {
          if (isLifeWagerActive) {
            setPlayerHP(0)
            setDrillProgress(5)
            triggerExecution()
            return
          }

          const dmg = critical ? START_HP : 20
          nextPlayerHP = Math.max(0, playerHP - dmg)
          nextDrill = Math.min(5, drillProgress + 1)
          setPlayerHP(nextPlayerHP)
          setEnemyWins((w) => w + 1)
          setDrillProgress(nextDrill)
          setCurrentDebt((d) => d + calculateDebtPenalty(roundWager ?? 10_000_000, mode === 'PVP'))
          audio.drill()
          audio.hitDamage(critical)
          setPlayerHit(true)
          later(() => setPlayerHit(false), 380)
          text = hardForcedLoss ? 'TIME EXPIRED. The drill bites deep.' : isPvp ? `${opponentName || 'Đối thủ'} wins the exchange.` : 'Hyodo wins the exchange.'
          audio.lose()
          if (mode === 'AI') later(() => hyodoTaunt(HYODO_LINES.hyodoWin), 400)
        } else {
          text = 'Stalemate — the round is void.'
        }

        setResultText(text)
        setPhase('result')

        later(() => {
          if (nextPlayerHP <= 0) {
            setEnding('execution')
            triggerExecution()
          } else if (nextEnemyHP <= 0) {
            setEnding('victory')
            triggerVictory()
          } else if (round >= TOTAL_ROUNDS) {
            const playerWinMargin = nextPlayerHP - nextEnemyHP
            const roundWinMargin = playerWins - enemyWins
            if (playerWinMargin > 0 || (playerWinMargin === 0 && roundWinMargin >= 0)) {
              setEnding('victory')
              triggerVictory()
            } else {
              setEnding('execution')
              triggerExecution()
            }
          } else {
            setRound((r) => r + 1)
            startRound(round + 1)
          }
        }, 2200)
      }, 1200)
    },
    [playerHP, enemyHP, drillProgress, isLifeWagerActive, mode, round, startRound, triggerExecution, triggerVictory, roundWager, hyodoTaunt, later, opponentName],
  )

  const resolveReveal = useCallback(
    (forced: boolean) => {
      const pIdx = selectedIndex ?? Math.floor(Math.random() * playerHand.length)
      const pCard = playerHand[pIdx]
      if (!pCard) return

      if (modeRef.current === 'PVP') {
        // Broadcast my real pick (once per round) — the opponent's browser
        // is the only thing that decides their side of the clash.
        if (pvpMyPickSentRoundRef.current !== round) {
          pvpMyPickSentRoundRef.current = round
          wsRef.current?.emit('PVP_CARD_PICK', { roomCode, round, cardType: pCard.type, playerName: name })
        }
        setWagerLocked(true)
        const opp = pvpOpponentPickRef.current
        if (opp && opp.round === round) {
          finishRound(pCard, { id: `net-${round}`, type: opp.cardType }, forced, true)
        } else {
          setPvpAwaitingOpponent(true)
        }
        return
      }

      const eIdx = Math.max(0, Math.min(enemyHand.length - 1, Math.round(unscramble(enemyPickRef.current))))
      const eCard = enemyHand[eIdx]
      if (!eCard) return
      finishRound(pCard, eCard, forced, false)
    },
    [selectedIndex, playerHand, enemyHand, round, roomCode, name, finishRound],
  )

  // ---- Opponent's real card pick lands mid-round: resolve immediately if
  // we already locked ours in for this same round. ----
  useEffect(() => {
    if (!wsRef.current || mode !== 'PVP') return
    const engine = wsRef.current
    function onPick(data: any) {
      if (!roomCode || data.roomCode !== roomCode) return
      if (data.round === round && pvpMyPickSentRoundRef.current === round) {
        const pIdx = selectedIndex ?? 0
        const pCard = playerHand[pIdx]
        if (pCard) finishRound(pCard, { id: `net-${round}`, type: data.cardType }, false, true)
      } else {
        // Their pick landed before ours (or for a round we haven't reached
        // yet) — stash it so resolveReveal can pick it straight up.
        pvpOpponentPickRef.current = { round: data.round, cardType: data.cardType }
      }
    }
    engine.on('PVP_CARD_PICK', onPick)
    return () => engine.off('PVP_CARD_PICK', onPick)
  }, [wsConnected, mode, roomCode, round, selectedIndex, playerHand, finishRound])

  const onReady = useCallback(() => {
    if (selectedIndex === null || phase !== 'select' || executing || pvpAwaitingOpponent) return
    setWagerLocked(true)
    resolveReveal(false)
  }, [selectedIndex, phase, executing, pvpAwaitingOpponent, resolveReveal])

  // ---- TIMER EFFECT ----
  useEffect(() => {
    if (!mounted || screen !== 'game' || phase !== 'select' || executing || pvpAwaitingOpponent) return
    const id = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          window.clearInterval(id)
          resolveReveal(true)
          return 0
        }
        if (t <= 10 && !stallTauntedRef.current && mode === 'AI') {
          stallTauntedRef.current = true
          hyodoTaunt(HYODO_LINES.stall)
        }
        return t - 1
      })
    }, 1000)
    intervalsRef.current.push(id)
    return () => {
      window.clearInterval(id)
      intervalsRef.current = intervalsRef.current.filter((x) => x !== id)
    }
  }, [screen, phase, executing, mode, roomCode, resolveReveal, hyodoTaunt, mounted])

  // ---- DUNGEON LOCK TIMER ----
  useEffect(() => {
    if (!mounted || !dungeonLocked) return
    const id = window.setInterval(() => {
      setDungeonSeconds((s) => {
        if (s <= 1) {
          window.clearInterval(id)
          setDungeonLocked(false)
          return 0
        }
        return s - 1
      })
    }, 1000)
    intervalsRef.current.push(id)
    return () => {
      window.clearInterval(id)
      intervalsRef.current = intervalsRef.current.filter((x) => x !== id)
    }
  }, [dungeonLocked, mounted])

  const surrender = useCallback(() => {
    audio.click()
    clearTimers()

    // SAFE EXIT: If the match hasn't really started or we are just waiting for opponent to join/pick,
    // we can exit without the 5-min dungeon lock penalty.
    const isSafeExit = pvpAwaitingOpponent || (mode === 'PVP' && round === 1 && phase === 'select' && playerHP === START_HP)

    if (mode === 'PVP' && roomCode) {
      wsRef.current?.emit('ROOM_DESTROYED', { roomCode, hostName: displayName })
    }
    if (hostedRoomRef.current) {
      const roomCodeToRemove = hostedRoomRef.current
      unregisterServerRoom(roomCodeToRemove)
      setServers((prev) => prev.filter((server) => server.id !== roomCodeToRemove))
      hostedRoomRef.current = undefined
    }

    if (mode === 'AI' || isSafeExit) {
      audio.stopHeart?.()
      resetPvpSession()
      setScreen('lobby')
      if (isSafeExit) addMessage('system', 'Đã thoát phòng an toàn.')
      return
    }

    if (profile.role === 'admin') {
      addMessage('system', 'Quản trị viên bỏ qua thời gian khóa ngắn.')
      resetPvpSession()
      setScreen('lobby')
      return
    }

    const until = Date.now() + getDungeonCooldownMs()
    saveDungeonLock(until)
    setDungeonLocked(true)
    setSplit(true)
    audio.explosion()
    const updated = recordDeath(displayName, { debt: currentDebt + LOSS_DEBT, fingerprint, role: profile.role })
    setLeaderboard(updated)
    setProfile(recordMatchOutcome({ forfeit: true }))
  }, [mode, roomCode, clearTimers, displayName, currentDebt, pvpAwaitingOpponent, round, phase, playerHP])

  // ---- PVP WAITING TIMEOUT ----
  useEffect(() => {
    if (!mounted || screen !== 'game' || !pvpAwaitingOpponent) return

    // Auto-exit if waiting for opponent pick for more than 45 seconds
    const timeoutId = window.setTimeout(() => {
      addMessage('system', 'Đối thủ quá lâu không phản hồi. Tự động thoát bàn.')
      surrender()
    }, 45000)

    return () => window.clearTimeout(timeoutId)
  }, [mounted, screen, pvpAwaitingOpponent, surrender])

  const onQuickTaunt = useCallback(
    (text: string) => {
      sendRoomChat(text)
      addBubble('player', text)
    },
    [sendRoomChat, addBubble],
  )

  const onSendRoom = useCallback((text: string) => sendRoomChat(text), [sendRoomChat])

  // ---- KEYBOARD CONTROLS ----
  useEffect(() => {
    if (!mounted || screen !== 'game') return
    function onKey(e: KeyboardEvent) {
      if (inputActive || phase !== 'select' || executing) return
      if (e.key === 'ArrowLeft') {
        setSelectedIndex((i) => (i === null ? 0 : Math.max(0, i - 1)))
        audio.select()
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex((i) => (i === null ? 0 : Math.min((playerHand?.length ?? 0) - 1, i + 1)))
        audio.select()
      } else if (e.key === 'Enter') {
        onReady()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, inputActive, phase, executing, playerHand?.length, onReady, mounted])

  // ---- SSR PROTECTION ----
  if (!mounted) return <div className="min-h-screen bg-black" />

  if (screen === 'intro') {
    return (
      <IntroStory onFinish={() => setScreen('lobby')} />
    )
  }

  if (screen === 'lobby') {
    return (
      <>
          <Lobby
            leaderboard={leaderboard}
            profile={profile}
            servers={servers}
            onStart={startMatch}
            onProfileNameChange={(playerName) => setProfile((p) => ({ ...p, playerName }))}
            onSaveProfile={(patch) => setProfile(patchProfile(patch))}
            onReplayIntro={() => setScreen('intro')}
            worldChatMessages={globalChatMessages}
            onWorldChatSend={onWorldChatSend}
            wsConnected={wsConnected}
            isAdmin={profile.role === 'admin'}
            onMutePlayer={onMutePlayer}
            onInvitePlayer={onInvitePlayer}
            pvpWaiting={pvpWaiting}
            waitingRoomCode={roomCode}
            onCancelPvpWaiting={cancelPvpWaiting}
          />
        {dungeonLocked && <DungeonLock secondsLeft={dungeonSeconds} />}
        {!wsConnected && (
          <div className="fixed bottom-4 left-4 bg-yellow-900/80 border border-yellow-600 px-4 py-2 rounded text-yellow-200 text-xs uppercase font-bold">
            ⚠️ WebSocket Disconnected - Reconnecting...
          </div>
        )}
      </>
    )
  }

  const playerBubble = bubbles?.find((b) => b?.side === 'player')
  const enemyBubble = bubbles?.find((b) => b?.side === 'enemy')
  const enemyLabel = mode === 'PVP' ? (opponentName || 'Đối Thủ') : 'Chairman Hyodo'
  const enemyShortLabel = mode === 'PVP' ? (opponentName || 'Đối Thủ') : 'Hyodo'

  return (
    <div className={`vignette relative min-h-screen w-full overflow-hidden ${monochrome ? 'monochrome' : ''} ${matchEnterGlitch ? 'violent-shake' : ''}`}>
      {matchEnterGlitch && <div className="match-enter-glitch-overlay" aria-hidden="true" />}
      <div
        className={`flicker absolute inset-0 ${shake ? 'shake' : ''}`}
        style={{
          background:
            faction === 'KING'
              ? 'radial-gradient(circle at 50% 40%, #1c160e 0%, #0a0805 75%)'
              : 'radial-gradient(circle at 50% 40%, #240f0f 0%, #0a0505 75%)',
        }}
      />

      <button
        onClick={surrender}
        className="absolute left-4 top-4 z-40 rounded border border-[#3a2b2b] bg-[#1a1010] px-3 py-2 text-xs uppercase text-[#8a6b6b] hover:text-blood transition-colors"
      >
        Đầu Hàng Vô Điều Kiện
      </button>

      <button
        onClick={() => setMuted((m) => !m)}
        className="absolute right-4 top-4 z-40 rounded border border-border bg-card/70 px-3 py-2 text-xs uppercase text-muted-foreground hover:text-foreground transition-colors"
      >
        {muted ? 'Unmute' : 'Mute'}
      </button>

      {!wsConnected && (
        <div className="absolute right-4 top-16 bg-red-900/80 border border-red-600 px-3 py-2 rounded text-red-200 text-[10px] uppercase font-bold">
          🔴 WebSocket Offline
        </div>
      )}

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-4 pb-6 pt-16">
        <Hud
          round={round ?? 1}
          faction={faction}
          playerHP={playerHP ?? 0}
          enemyHP={enemyHP ?? 0}
          playerWins={playerWins ?? 0}
          enemyWins={enemyWins ?? 0}
          timeLeft={timeLeft ?? 0}
          bpm={bpm ?? 70}
          drillProgress={drillProgress ?? 0}
          playerHit={playerHit}
          enemyHit={enemyHit}
        />

        {/* OPPONENT WAGER NOTIFICATION */}
        {opponentWagerNotification && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gold/20 border-2 border-gold px-6 py-3 rounded-lg animate-pulse shadow-[0_0_20px_rgba(179,145,74,0.6)]">
            <p className="font-display text-lg text-gold font-black tracking-wider">{opponentWagerNotification}</p>
          </div>
        )}

        <div className="flex flex-1 items-center justify-between gap-2">
          <div className="relative flex flex-col items-center">
            {playerBubble && (
              <div className="absolute -top-14 z-30 max-w-[160px] animate-bounce rounded-lg border border-gold/50 bg-black px-3 py-1.5 text-center text-xs text-white shadow-lg">
                {playerBubble.text}
              </div>
            )}
            <Silhouette faction={faction} side="left" drillProgress={drillProgress} split={split} injuryLevel={Math.max(0, Math.min(1, 1 - playerHP / START_HP))} label="You" />
            <span className="mt-1 font-sans text-sm uppercase font-bold text-[#9e2a2b] drop-shadow-[0_0_5px_rgba(158,42,43,0.5)]">{name}</span>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            {phase !== 'select' && revealedPlayer && revealedEnemy ? (
              <div
                className="relative flex items-center gap-6 rounded-xl px-8 py-6"
                style={{
                  background:
                    'radial-gradient(circle at 50% 40%, rgba(60,45,20,0.35) 0%, rgba(0,0,0,0.55) 70%)',
                  border: '1px solid rgba(179,145,74,0.25)',
                  boxShadow:
                    '0 10px 30px -5px rgba(0,0,0,0.9), 0 20px 60px -10px rgba(0,0,0,0.95), inset 0 1px 0 0 rgba(255,255,255,0.03), inset 0 0 40px rgba(0,0,0,0.6)',
                }}
              >
                <span
                  className="pointer-events-none absolute left-2 top-2 h-3 w-3 border-l border-t"
                  style={{ borderColor: 'rgba(179,145,74,0.4)' }}
                />
                <span
                  className="pointer-events-none absolute right-2 top-2 h-3 w-3 border-r border-t"
                  style={{ borderColor: 'rgba(179,145,74,0.4)' }}
                />
                <span
                  className="pointer-events-none absolute bottom-2 left-2 h-3 w-3 border-b border-l"
                  style={{ borderColor: 'rgba(179,145,74,0.4)' }}
                />
                <span
                  className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-b border-r"
                  style={{ borderColor: 'rgba(179,145,74,0.4)' }}
                />
                <PlayingCard type={revealedPlayer.type} faceUp />
                <span className="font-display text-3xl text-blood drop-shadow-[0_0_10px_rgba(158,42,43,0.6)]">VS</span>
                <PlayingCard type={revealedEnemy.type} faceUp />
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="bg-black/40 p-4 rounded-lg border border-zinc-800 backdrop-blur-sm">
                  <label className="block text-[10px] uppercase tracking-widest text-zinc-500 mb-2">MỨC CƯỢC VÒNG NÀY / ROUND WAGER</label>
                  <input
                    type="range"
                    min="1000000"
