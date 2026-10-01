const crypto = require('crypto');
const { Booking } = require('../models');
const config = require('../config');
const { minAttendanceSeconds } = config;

const toId = (value) => String(value?._id || value || '');

/** The span during which a booking's video room is open. */
function sessionWindow(booking) {
  const start = new Date(booking.proposedTime).getTime();
  const end = start + (booking.durationMinutes || 60) * 60000;
  return {
    startsAt: new Date(start),
    endsAt: new Date(end),
    opensAt: new Date(start - config.joinEarlyMinutes() * 60000),
    closesAt: new Date(end + config.graceMinutes() * 60000)
  };
}

/**
 * Decides whether `userId` may be in the booking's room right now.
 * Returns { ok, code, message, ...window }.
 */
function evaluateAccess(booking, userId, now = new Date()) {
  const window = sessionWindow(booking);
  const deny = (code, message) => ({ ok: false, code, message, ...window });
  const isParticipant = [toId(booking.requester), toId(booking.provider)].includes(toId(userId));
  if (!isParticipant) return deny('FORBIDDEN', 'You are not part of this session');
  if (booking.status === 'pending') return deny('NOT_CONFIRMED', 'The teacher has not confirmed this session yet');
  if (booking.status === 'completed') return deny('COMPLETED', 'This session has already been completed');
  if (booking.status !== 'accepted') return deny('UNAVAILABLE', `This session was ${booking.status}`);
  if (now < window.opensAt) return deny('TOO_EARLY', 'The room opens shortly before the scheduled start');
  if (now > window.closesAt) return deny('CLOSED', 'This session has ended');
  return { ok: true, ...window };
}

/**
 * ICE servers for WebRTC. STUN is always included. When TURN is configured the
 * relay credentials are short-lived (coturn `use-auth-secret` scheme) or static.
 */
function buildIceServers(userId, nowMs = Date.now()) {
  const list = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  const servers = [{ urls: list(process.env.STUN_URLS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302') }];
  const turnUrls = list(process.env.TURN_URLS);
  if (!turnUrls.length) return servers;

  if (process.env.TURN_SECRET) {
    const expiresAt = Math.floor(nowMs / 1000) + 6 * 3600;
    const username = `${expiresAt}:${toId(userId)}`;
    const credential = crypto.createHmac('sha1', process.env.TURN_SECRET).update(username).digest('base64');
    servers.push({ urls: turnUrls, username, credential });
  } else if (process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    servers.push({ urls: turnUrls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  }
  return servers;
}

const attendanceOf = (booking, userId) => (booking.attendance || []).find((entry) => toId(entry.user) === toId(userId));

/** Both members were in the room long enough for the session to count as held. */
function bothAttended(booking) {
  const required = minAttendanceSeconds();
  return [booking.requester, booking.provider].every((party) => (attendanceOf(booking, party)?.totalSeconds || 0) >= required);
}

const newRoomId = () => crypto.randomBytes(16).toString('hex');

async function recordJoin(bookingId, userId, now = new Date()) {
  await Booking.updateOne(
    { _id: bookingId, 'attendance.user': { $ne: userId } },
    { $push: { attendance: { user: userId, firstJoinedAt: now, totalSeconds: 0 } } }
  );
}

async function recordLeave(bookingId, userId, seconds, now = new Date()) {
  await Booking.updateOne(
    { _id: bookingId, 'attendance.user': userId },
    { $inc: { 'attendance.$.totalSeconds': Math.max(0, Math.round(seconds)) }, $set: { 'attendance.$.lastLeftAt': now } }
  );
}

module.exports = { sessionWindow, evaluateAccess, buildIceServers, bothAttended, attendanceOf, newRoomId, recordJoin, recordLeave };
