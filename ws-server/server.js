// ============================================================================
// KAIJI E-CARD — GLOBAL HUB WEBSOCKET RELAY SERVER
// ============================================================================
// A tiny, stateless broadcast relay. It doesn't need to understand the game's
// message types (GLOBAL_CHAT_MESSAGE, ROOM_CREATED, ROOM_DESTROYED,
// ROUND_WAGER_UPDATE, LIFE_WAGER_ACTIVATED) — the client already puts
// everything needed inside `payload`, so this server just re-broadcasts every
// valid JSON message it receives to every OTHER connected client.
//
// Run locally:   node server.js
// Deploy: see ../HUONG_DAN_WEBSOCKET.md for step-by-step (Render.com, free)
// ============================================================================

const { WebSocketServer } = require('ws')
const http = require('http')

const PORT = process.env.PORT || 8080

// Where the actual game UI lives (the Next.js app on Vercel). This relay
// server has no UI of its own — it only exists to broadcast realtime
// messages — but we redirect a friendly path here so you can hand out
// ONE link and it still lands people on the playable game.
// Override via the GAME_URL env var if you ever move the frontend.
const GAME_URL = process.env.GAME_URL || 'https://mygame-mash16.vercel.app'

// Plain HTTP server so hosts like Render can health-check with a normal GET.
// IMPORTANT: the root path "/" must keep returning a plain 200 response —
// Render's health check hits "/" and expects 200, not a redirect. That's
// why the redirect lives on a separate path ("/play") instead of "/".
const httpServer = http.createServer((req, res) => {
  const url = req.url || '/'

  if (url === '/play' || url === '/game' || url === '/join') {
    res.writeHead(302, { Location: GAME_URL })
    res.end()
    return
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Kaiji global hub is running.\n')
})

const wss = new WebSocketServer({ server: httpServer })

let clientCount = 0

wss.on('connection', (ws) => {
  clientCount += 1
  console.log(`[hub] client connected (${clientCount} online)`)

  ws.isAlive = true
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

    // Application-level heartbeat: answered directly to the sender only, so
    // the client can detect a half-open connection (proxy silently dropping
    // packets) even when the native WS ping/pong below hasn't caught it yet.
    if (parsed.type === 'PING') {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'PONG', payload: { timestamp: Date.now() } }))
      }
      return
    }

    // Re-broadcast to every other connected client (not back to the sender —
    // the game already renders its own outgoing chat/wager locally).
    const outgoing = JSON.stringify(parsed)
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === client.OPEN) {
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
