const { Server } = require('socket.io');
const { verifyToken } = require('@clerk/express');
const mongoose = require('mongoose');
const { User, Booking, Message } = require('../models');
const { evaluateAccess, recordJoin, recordLeave } = require('../services/sessionService');
const { setIo, userRoom, emitToUser } = require('../services/realtime');

const MAX_SIGNAL_BYTES = 20000;
const CHAT_WINDOW_MS = 10000;
const CHAT_LIMIT = 10;
const roomName = (roomId) => `room:${roomId}`;

/**
 * Attaches Socket.IO to the HTTP server.
 *
 * Every connection is authenticated with the member's Clerk session token and
 * joins a private `user:<id>` room for push notifications. A member may also
 * join the video room of a booking they take part in; the server relays WebRTC
 * signalling, media-state changes and in-call chat between the two participants
 * and records how long each was present.
 */
function attachSockets(httpServer, { origins = [] } = {}) {
  const io = new Server(httpServer, {
    cors: { origin: origins, credentials: true },
    maxHttpBufferSize: 1e5,
    pingInterval: 10000,
    pingTimeout: 8000
  });
  setIo(io);
  const roomTimers = new Map();

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
      const user = await User.findOne({ clerkId: payload.sub }).select('name status');
      if (!user || user.status === 'suspended') return next(new Error('unauthorized'));
      socket.data.user = { id: String(user._id), name: user.name };
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  /** Removes a socket from its video room, recording attendance and telling the peer. */
  async function leaveRoom(socket, { silent = false } = {}) {
    const room = socket.data.room;
    if (!room) return;
    socket.data.room = null;
    socket.leave(room.name);
    const seconds = (Date.now() - room.joinedAt) / 1000;
    await recordLeave(room.bookingId, socket.data.user.id, seconds).catch((error) => console.error('Attendance update failed:', error.message));
    if (!silent) io.to(room.name).emit('session:peer-left', { userId: socket.data.user.id });
    const remaining = await io.in(room.name).fetchSockets();
    if (!remaining.length && roomTimers.has(room.name)) {
      clearTimeout(roomTimers.get(room.name));
      roomTimers.delete(room.name);
    }
  }

  /** Closes a room when its grace period elapses. */
  function scheduleRoomEnd(name, closesAt) {
    if (roomTimers.has(name)) return;
    const timer = setTimeout(async () => {
      roomTimers.delete(name);
      io.to(name).emit('session:ended', { reason: 'time' });
      const sockets = await io.in(name).fetchSockets();
      await Promise.all(sockets.map((socket) => leaveRoom(socket, { silent: true })));
    }, Math.max(1000, closesAt.getTime() - Date.now()));
    timer.unref?.();
    roomTimers.set(name, timer);
  }

  io.on('connection', (socket) => {
    const me = socket.data.user;
    socket.join(userRoom(me.id));

    socket.on('session:join', async (payload, ack = () => {}) => {
      try {
        const bookingId = payload?.bookingId;
        if (!mongoose.Types.ObjectId.isValid(bookingId)) return ack({ ok: false, message: 'Invalid session' });
        const booking = await Booking.findById(bookingId);
        if (!booking || !booking.roomId) return ack({ ok: false, message: 'Session not found' });
        const access = evaluateAccess(booking, me.id);
        if (!access.ok) return ack({ ok: false, code: access.code, message: access.message });

        await leaveRoom(socket);
        const name = roomName(booking.roomId);
        const present = await io.in(name).fetchSockets();
        // One tab per member: a newer connection replaces an older one.
        await Promise.all(present.filter((other) => other.data.user.id === me.id).map(async (other) => {
          other.emit('session:replaced');
          await leaveRoom(other);
        }));

        const peerId = String(booking.requester) === me.id ? String(booking.provider) : String(booking.requester);
        socket.join(name);
        socket.data.room = { name, bookingId: String(booking._id), peerId, joinedAt: Date.now() };
        await recordJoin(booking._id, me.id);
        scheduleRoomEnd(name, access.closesAt);

        const peers = present.filter((other) => other.data.user.id !== me.id).map((other) => ({ userId: other.data.user.id, name: other.data.user.name }));
        socket.to(name).emit('session:peer-joined', { userId: me.id, name: me.name });
        return ack({ ok: true, peers, endsAt: access.endsAt, closesAt: access.closesAt });
      } catch (error) {
        console.error('Session join failed:', error.message);
        return ack({ ok: false, message: 'Could not join the session' });
      }
    });

    // WebRTC offers, answers and ICE candidates, relayed untouched to the other participant.
    socket.on('session:signal', (payload) => {
      const room = socket.data.room;
      if (!room || !payload || typeof payload !== 'object') return;
      if (JSON.stringify(payload).length > MAX_SIGNAL_BYTES) return;
      socket.to(room.name).emit('session:signal', { from: me.id, data: payload });
    });

    socket.on('session:media', (payload) => {
      const room = socket.data.room;
      if (!room || !payload) return;
      socket.to(room.name).emit('session:media', {
        from: me.id, audio: Boolean(payload.audio), video: Boolean(payload.video), screen: Boolean(payload.screen)
      });
    });

    socket.on('session:chat', async (payload, ack = () => {}) => {
      const room = socket.data.room;
      const body = typeof payload?.body === 'string' ? payload.body.trim() : '';
      if (!room || !body || body.length > 1000) return ack({ ok: false });
      const now = Date.now();
      socket.data.chatTimes = (socket.data.chatTimes || []).filter((time) => now - time < CHAT_WINDOW_MS);
      if (socket.data.chatTimes.length >= CHAT_LIMIT) return ack({ ok: false, message: 'You are sending messages too quickly' });
      socket.data.chatTimes.push(now);
      try {
        const peerPresent = (await io.in(room.name).fetchSockets()).some((other) => other.data.user.id === room.peerId);
        const message = await Message.create({
          sender: me.id, recipient: room.peerId, booking: room.bookingId, body, readAt: peerPresent ? new Date() : undefined
        });
        io.to(room.name).emit('session:chat', { _id: message._id, from: me.id, body: message.body, createdAt: message.createdAt });
        if (!peerPresent) emitToUser(room.peerId, 'message:new', { from: me.id });
        return ack({ ok: true });
      } catch (error) {
        console.error('Session chat failed:', error.message);
        return ack({ ok: false });
      }
    });

    socket.on('session:leave', () => leaveRoom(socket));
    socket.on('disconnect', () => { leaveRoom(socket); });
  });

  return io;
}

module.exports = { attachSockets };
