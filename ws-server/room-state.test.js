const test = require('node:test')
const assert = require('node:assert/strict')
const { applyRoomEvent } = require('./room-state')

test('creates waiting rooms and marks them as INGAME when a challenger joins', () => {
  const rooms = new Map()

  applyRoomEvent(rooms, {
    type: 'ROOM_CREATED',
    payload: { roomCode: 'ABC123', hostName: 'Host', wager: 50_000_000, faction: 'SLAVE', isPrivate: false },
  })

  assert.equal(rooms.get('ABC123').status, 'WAITING')

  applyRoomEvent(rooms, {
    type: 'ROOM_JOINED',
    payload: { roomCode: 'ABC123', challengerName: 'Guest' },
  })

  assert.equal(rooms.get('ABC123').status, 'INGAME')
})

test('removes a room from the directory when it is destroyed', () => {
  const rooms = new Map()

  applyRoomEvent(rooms, {
    type: 'ROOM_CREATED',
    payload: { roomCode: 'XYZ999', hostName: 'Host', wager: 10_000_000, faction: 'KING', isPrivate: true },
  })

  applyRoomEvent(rooms, {
    type: 'ROOM_DESTROYED',
    payload: { roomCode: 'XYZ999', hostName: 'Host' },
  })

  assert.equal(rooms.has('XYZ999'), false)
})
