function applyRoomEvent(activeRooms, parsed) {
  if (!parsed || typeof parsed.type !== 'string') return activeRooms

  if (parsed.type === 'ROOM_CREATED') {
    activeRooms.set(parsed.payload.roomCode, {
      ...parsed.payload,
      id: parsed.payload.roomCode,
      status: 'WAITING',
      createdAt: Date.now(),
    })
  } else if (parsed.type === 'ROOM_DESTROYED') {
    activeRooms.delete(parsed.payload.roomCode)
  } else if (parsed.type === 'ROOM_JOINED') {
    const room = activeRooms.get(parsed.payload.roomCode)
    if (room) {
      room.status = 'INGAME'
    }
  } else if (parsed.type === 'ROOM_STARTED') {
    const room = activeRooms.get(parsed.payload.roomCode)
    if (room) {
      room.status = 'INGAME'
    }
  }

  return activeRooms
}

module.exports = { applyRoomEvent }
