jest.mock('@clerk/express', () => ({
  verifyToken: jest.fn(async (token) => {
    if (token === 'bad') throw new Error('invalid');
    return { sub: token };
  }),
  getAuth: jest.fn(),
  clerkClient: { users: {} },
  clerkMiddleware: () => (req, res, next) => next()
}));

const http = require('http');
const { io: connect } = require('socket.io-client');
const { startDb, stopDb, clearDb } = require('./helpers/db');
const { makeUser, makeBooking, hoursFromNow } = require('./helpers/factories');
const { Booking, Message, Notification } = require('../models');
const { attachSockets } = require('../sockets');
const { createInAppNotification } = require('../services/notificationService');

jest.setTimeout(90000);

let server;
let io;
let url;
const clients = [];

beforeAll(async () => {
  await startDb();
  server = http.createServer();
  io = attachSockets(server, { origins: ['http://localhost:5173'] });
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});
afterAll(async () => {
  io.close();
  await new Promise((resolve) => server.close(resolve));
  await stopDb();
});
beforeEach(clearDb);
afterEach(() => { while (clients.length) clients.pop().close(); });

const client = (token) => new Promise((resolve, reject) => {
  const socket = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false });
  clients.push(socket);
  socket.on('connect', () => resolve(socket));
  socket.on('connect_error', reject);
});
const emit = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));
const once = (socket, event) => new Promise((resolve) => socket.once(event, resolve));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A confirmed session that starts in ~3 minutes, i.e. inside the join window.
const scenario = async (overrides = {}) => {
  const learner = await makeUser();
  const teacher = await makeUser();
  const booking = await makeBooking(learner, teacher, { status: 'accepted', roomId: 'c'.repeat(32), escrow: 'held', proposedTime: hoursFromNow(0.05), ...overrides });
  return { learner, teacher, booking };
};
const join = (socket, booking) => emit(socket, 'session:join', { bookingId: String(booking._id) });

describe('socket authentication', () => {
  test('rejects connections without a valid session token', async () => {
    await expect(client('bad')).rejects.toThrow('unauthorized');
    await expect(client(undefined)).rejects.toThrow('unauthorized');
  });

  test('rejects members with no application profile, or suspended ones', async () => {
    await expect(client('clerk_unknown')).rejects.toThrow('unauthorized');
    const banned = await makeUser({ status: 'suspended' });
    await expect(client(banned.clerkId)).rejects.toThrow('unauthorized');
  });
});

describe('joining a session room', () => {
  test('lets both participants in and tells each about the other', async () => {
    const { learner, teacher, booking } = await scenario();
    const a = await client(learner.clerkId);
    const b = await client(teacher.clerkId);

    expect(await join(a, booking)).toMatchObject({ ok: true, peers: [] });

    const joined = once(a, 'session:peer-joined');
    const second = await join(b, booking);
    expect(second.ok).toBe(true);
    expect(second.peers).toEqual([{ userId: String(learner._id), name: learner.name }]);
    expect(await joined).toEqual({ userId: String(teacher._id), name: teacher.name });
  });

  test('refuses outsiders, unconfirmed bookings, and rooms that are not open', async () => {
    const { booking } = await scenario();
    const stranger = await makeUser();
    expect(await join(await client(stranger.clerkId), booking)).toMatchObject({ ok: false, code: 'FORBIDDEN' });

    const pending = await scenario({ status: 'pending' });
    expect(await join(await client(pending.learner.clerkId), pending.booking)).toMatchObject({ ok: false, code: 'NOT_CONFIRMED' });

    const early = await scenario({ proposedTime: hoursFromNow(48) });
    expect(await join(await client(early.learner.clerkId), early.booking)).toMatchObject({ ok: false, code: 'TOO_EARLY' });

    const over = await scenario({ proposedTime: hoursFromNow(-5) });
    expect(await join(await client(over.learner.clerkId), over.booking)).toMatchObject({ ok: false, code: 'CLOSED' });

    const member = await client(stranger.clerkId);
    expect(await emit(member, 'session:join', { bookingId: 'nope' })).toMatchObject({ ok: false });
  });

  test('relays WebRTC signalling and media state to the other participant only', async () => {
    const { learner, teacher, booking } = await scenario();
    const a = await client(learner.clerkId);
    const b = await client(teacher.clerkId);
    await join(a, booking);
    await join(b, booking);

    const received = once(b, 'session:signal');
    a.emit('session:signal', { description: { type: 'offer', sdp: 'v=0' } });
    expect(await received).toEqual({ from: String(learner._id), data: { description: { type: 'offer', sdp: 'v=0' } } });

    const media = once(a, 'session:media');
    b.emit('session:media', { audio: false, video: true, screen: false, extra: 'ignored' });
    expect(await media).toEqual({ from: String(teacher._id), audio: false, video: true, screen: false });
  });

  test('ignores signals from a socket that has not joined the room', async () => {
    const { learner, teacher, booking } = await scenario();
    const a = await client(learner.clerkId);
    const b = await client(teacher.clerkId);
    await join(b, booking);
    const spy = jest.fn();
    b.on('session:signal', spy);
    a.emit('session:signal', { description: { type: 'offer' } });
    await pause(200);
    expect(spy).not.toHaveBeenCalled();
  });

  test('persists in-call chat and delivers it to both participants', async () => {
    const { learner, teacher, booking } = await scenario();
    const a = await client(learner.clerkId);
    const b = await client(teacher.clerkId);
    await join(a, booking);
    await join(b, booking);

    const toTeacher = once(b, 'session:chat');
    const toLearner = once(a, 'session:chat');
    expect(await emit(a, 'session:chat', { body: '  Hello there  ' })).toEqual({ ok: true });
    expect((await toTeacher).body).toBe('Hello there');
    expect((await toLearner).from).toBe(String(learner._id));

    const stored = await Message.findOne({ booking: booking._id });
    expect(stored.body).toBe('Hello there');
    expect(String(stored.sender)).toBe(String(learner._id));
    expect(stored.readAt).toBeTruthy(); // the peer was in the room

    expect(await emit(a, 'session:chat', { body: '' })).toEqual({ ok: false });
    expect(await emit(a, 'session:chat', { body: 'x'.repeat(1001) })).toEqual({ ok: false });
  });

  test('records attendance and notifies the peer when someone leaves', async () => {
    const { learner, teacher, booking } = await scenario();
    const a = await client(learner.clerkId);
    const b = await client(teacher.clerkId);
    await join(a, booking);
    await join(b, booking);

    const left = once(b, 'session:peer-left');
    a.emit('session:leave');
    expect(await left).toEqual({ userId: String(learner._id) });
    await pause(250);
    const stored = await Booking.findById(booking._id);
    expect(stored.attendance.map((entry) => String(entry.user)).sort()).toEqual([String(learner._id), String(teacher._id)].sort());
    expect(stored.attendance.find((entry) => String(entry.user) === String(learner._id)).lastLeftAt).toBeTruthy();
  });

  test('a second tab replaces the first for the same member', async () => {
    const { learner, booking } = await scenario();
    const first = await client(learner.clerkId);
    await join(first, booking);
    const replaced = once(first, 'session:replaced');
    const second = await client(learner.clerkId);
    expect((await join(second, booking)).ok).toBe(true);
    await replaced;
  });
});

describe('realtime push', () => {
  test('in-app notifications reach the open tabs of a member immediately', async () => {
    const member = await makeUser();
    const socket = await client(member.clerkId);
    const pushed = once(socket, 'notification:new');
    const booking = await makeBooking(member, await makeUser());
    await createInAppNotification({ userId: member._id, type: 'booking', message: 'Hello', relatedId: booking._id });
    expect(await pushed).toEqual({ type: 'booking', message: 'Hello' });
    expect(await Notification.countDocuments({ userId: member._id })).toBe(1);
  });
});
