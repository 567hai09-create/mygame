function getRoomCode(payload) {
  if (!payload || typeof payload !== 'object') return null
  const roomCode = payload.roomCode
  return typeof roomCode === 'string' && roomCode.trim() ? roomCode : null
}

function applyRoomEvent(activeRooms, parsed) {
  if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') return activeRooms

  const payload = parsed.payload && typeof parsed.payload === 'object' ? parsed.payload : {}

  if (parsed.type === 'ROOM_CREATED') {
    const roomCode = getRoomCode(payload)
    if (!roomCode) return activeRooms

    activeRooms.set(roomCode, {
      ...payload,
      id: roomCode,
      roomCode,
      status: 'WAITING',
      createdAt: Date.now(),
    })
  } else if (parsed.type === 'ROOM_DESTROYED') {
    const roomCode = getRoomCode(payload)
    if (!roomCode) return activeRooms

    activeRooms.delete(roomCode)
  } else if (parsed.type === 'ROOM_JOINED' || parsed.type === 'ROOM_STARTED') {
    const roomCode = getRoomCode(payload)
    if (!roomCode) return activeRooms

    const room = activeRooms.get(roomCode)
    if (room) {
      room.status = 'INGAME'
    }
  }

  return activeRooms
}

module.exports = { applyRoomEvent }
