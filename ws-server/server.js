// ============================================================================
// KAIJI E-CARD — GLOBAL HUB WEBSOCKET RELAY SERVER
// ============================================================================
// A stateful broadcast relay that tracks active rooms.
// ============================================================================

const { WebSocketServer } = require('ws')
const http = require('http')
const { applyRoomEvent } = require('./room-state')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 8080

// Plain HTTP server so hosts like Render can health-check with a normal GET.
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Kaiji global hub is running.\n')
})

const wss = new WebSocketServer({ server: httpServer })

let clientCount = 0
// Server-side room directory to ensure all new clients get the current state
const activeRooms = new Map()
// Server-side temporary locks for AI matches: Map<clientId, untilTimestampMs>
const aiLocks = new Map()
const LOCK_FILE = path.join(__dirname, 'ai-locks.json')

function loadLocksFromDisk() {
  try {
    if (!fs.existsSync(LOCK_FILE)) return
    const raw = fs.readFileSync(LOCK_FILE, 'utf8')
    const obj = JSON.parse(raw || '{}')
    const now = Date.now()
    for (const [k, v] of Object.entries(obj)) {
      const until = Number(v) || 0
      if (until > now) aiLocks.set(k, until)
    }
  } catch (err) {
    console.warn('[hub] failed to load ai locks from disk:', err.message)
  }
}

function saveLocksToDisk() {
  try {
    const obj = {}
    for (const [k, v] of aiLocks.entries()) obj[k] = v
    fs.writeFileSync(LOCK_FILE, JSON.stringify(obj), { encoding: 'utf8' })
  } catch (err) {
    console.warn('[hub] failed to save ai locks to disk:', err.message)
  }
}

// Load persisted locks at startup
loadLocksFromDisk()

// Periodic cleanup of expired locks (and persist after cleanup)
const lockCleanup = setInterval(() => {
  const now = Date.now()
  let changed = false
  for (const [k, until] of aiLocks.entries()) {
    if (until <= now) {
      aiLocks.delete(k)
      changed = true
    }
  }
  if (changed) saveLocksToDisk()
}, 5000)

wss.on('connection', (ws) => {
  clientCount += 1
  console.log(`[hub] client connected (${clientCount} online)`)
  ws.isAlive = true

  // Send current rooms to the new client immediately upon connection
  if (activeRooms.size > 0) {
    const roomList = Array.from(activeRooms.values())
    ws.send(JSON.stringify({ 
      type: 'SYNC_ROOMS', 
      payload: { rooms: roomList } 
    }))
  }

  ws.on('pong', () => {
    ws.isAlive = true
  })

  ws.on('message', (raw) => {
    let parsed
    try {
      parsed = JSON.parse(raw.toString())
    } catch {
      console.warn('[hub] dropped non-JSON message')
      return
    }
    if (!parsed || typeof parsed.type !== 'string') {
      console.warn('[hub] dropped message with no type')
      return
    }

    // Server-side AI match locking: handle requests and loss notifications
    if (parsed.type === 'AI_MATCH_REQUEST') {
      // Expect clientId in payload (emitted by client-side engine)
      const clientId = parsed.payload && parsed.payload.clientId
      const fp = parsed.payload && parsed.payload.fingerprint
      const key = clientId || fp || null
      const now = Date.now()
      if (key && aiLocks.has(key) && aiLocks.get(key) > now) {
        const remaining = aiLocks.get(key) - now
        // Reply only to requester with rejection
        try {
          ws.send(JSON.stringify({ type: 'AI_MATCH_REJECTED', payload: { remainingMs: remaining } }))
        } catch (err) {}
        return
      }
      // Otherwise approve
      try {
        ws.send(JSON.stringify({ type: 'AI_MATCH_APPROVED', payload: {} }))
      } catch (err) {}
      return
    }

    if (parsed.type === 'AI_MATCH_LOSS') {
      const clientId = parsed.payload && parsed.payload.clientId
      const fp = parsed.payload && parsed.payload.fingerprint
      const key = clientId || fp || null
      if (key) {
        const until = Date.now() + 30_000 // 30 seconds
        aiLocks.set(key, until)
        // persist immediately
        saveLocksToDisk()
      }
      // Do not rebroadcast loss notifications
      return
    }

    // Application-level heartbeat: answered directly to the sender only
    if (parsed.type === 'PING') {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'PONG', payload: { timestamp: Date.now() } }))
      }
      return
    }

    // Room Lifecycle Management on Server
    applyRoomEvent(activeRooms, parsed)

    // Re-broadcast to every connected client so room lifecycle messages are
    // visible to the sender as well as other peers.
    const outgoing = JSON.stringify(parsed)
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(outgoing)
      }
    })
  })

  ws.on('close', () => {
    clientCount -= 1
    console.log(`[hub] client disconnected (${clientCount} online)`)
  })

  ws.on('error', (err) => {
    console.error('[hub] socket error:', err.message)
  })
})

// Drop dead connections (client tab closed without a clean handshake, laptop
// went to sleep, etc.) so `wss.clients` stays accurate. Runs every 30s.
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate()
    ws.isAlive = false
    ws.ping()
  })
}, 30_000)

wss.on('close', () => clearInterval(heartbeat))

httpServer.listen(PORT, () => {
  console.log(`🚀 Kaiji global hub listening on port ${PORT}`)
})
