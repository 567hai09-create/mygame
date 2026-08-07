// ============================================================================
// KAIJI E-CARD — GLOBAL HUB WEBSOCKET RELAY SERVER
// ============================================================================
// A stateful broadcast relay that tracks active rooms.
// ============================================================================

const { WebSocketServer } = require('ws')
const http = require('http')

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

    // Application-level heartbeat: answered directly to the sender only
    if (parsed.type === 'PING') {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'PONG', payload: { timestamp: Date.now() } }))
      }
      return
    }

    // Room Lifecycle Management on Server
    if (parsed.type === 'ROOM_CREATED') {
      activeRooms.set(parsed.payload.roomCode, {
        ...parsed.payload,
        id: parsed.payload.roomCode,
        status: 'WAITING',
        createdAt: Date.now()
      })
    } else if (parsed.type === 'ROOM_DESTROYED') {
      activeRooms.delete(parsed.payload.roomCode)
    } else if (parsed.type === 'ROOM_STARTED') {
      const room = activeRooms.get(parsed.payload.roomCode)
      if (room) {
        room.status = 'INGAME'
      }
    }

    // Re-broadcast to every other connected client
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
