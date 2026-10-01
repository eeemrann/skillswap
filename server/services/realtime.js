/**
 * Holds the Socket.IO server so request handlers and workers can push events
 * to members without importing the socket layer (and without needing it in tests).
 */
let io = null;

const setIo = (server) => { io = server; };
const getIo = () => io;
const userRoom = (userId) => `user:${userId}`;

/** Pushes an event to every open tab of a member. Silently does nothing when sockets are not running. */
function emitToUser(userId, event, payload = {}) {
  if (!io || !userId) return;
  io.to(userRoom(String(userId))).emit(event, payload);
}

module.exports = { setIo, getIo, emitToUser, userRoom };
