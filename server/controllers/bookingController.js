const mongoose = require('mongoose');
const { Booking } = require('../models');
const { SESSION_DURATIONS } = require('../config/plans');
const { HttpError } = require('../utils/transaction');
const { requestBooking, acceptBooking, declineBooking, closeBooking, settleBooking } = require('../services/bookingService');
const { sessionWindow, bothAttended } = require('../services/sessionService');

const MIN_LEAD_MINUTES = 15;
const MAX_LEAD_DAYS = 180;

/** Booking as sent to clients: no room secret, plus the join window and attendance flags. */
function serialize(booking) {
  const plain = booking.toObject ? booking.toObject() : { ...booking };
  const window = sessionWindow(plain);
  delete plain.roomId;
  delete plain.idempotencyKey;
  const attended = (party) => (plain.attendance || []).some((entry) => String(entry.user) === String(party?._id || party));
  return {
    ...plain,
    endsAt: window.endsAt,
    joinOpensAt: window.opensAt,
    joinClosesAt: window.closesAt,
    attendedBy: { requester: attended(plain.requester), provider: attended(plain.provider) },
    sessionHeld: bothAttended(plain)
  };
}

exports.createBooking = async (req, res) => {
  const idempotencyKey = String(req.get('Idempotency-Key') || '').trim();
  const providerId = String(req.body.providerId || '');
  const skill = String(req.body.skill || '').trim();
  const note = String(req.body.note || '').trim().slice(0, 500);
  const durationMinutes = Number(req.body.durationMinutes || 60);
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey)) throw new HttpError(400, 'A valid Idempotency-Key header is required');
  if (!mongoose.Types.ObjectId.isValid(providerId)) throw new HttpError(400, 'Invalid provider id');
  if (String(providerId) === String(req.userId)) throw new HttpError(400, 'You cannot book a session with yourself');
  if (!skill) throw new HttpError(400, 'Choose a skill to learn');
  if (!SESSION_DURATIONS.includes(durationMinutes)) throw new HttpError(400, `Duration must be one of ${SESSION_DURATIONS.join(', ')} minutes`);
  const time = new Date(req.body.proposedTime);
  const now = Date.now();
  if (Number.isNaN(time.getTime()) || time.getTime() < now + MIN_LEAD_MINUTES * 60000) throw new HttpError(400, `Sessions must start at least ${MIN_LEAD_MINUTES} minutes from now`);
  if (time.getTime() > now + MAX_LEAD_DAYS * 86400000) throw new HttpError(400, `Sessions can be booked up to ${MAX_LEAD_DAYS} days ahead`);

  const previous = await Booking.findOne({ requester: req.userId, idempotencyKey });
  if (previous) return res.json(serialize(previous));
  try {
    const booking = await requestBooking({ requesterId: req.userId, providerId, skill, note, proposedTime: time, durationMinutes, idempotencyKey });
    return res.status(201).json(serialize(booking));
  } catch (error) {
    if (error.code === 11000) {
      const existing = await Booking.findOne({ requester: req.userId, idempotencyKey });
      if (existing) return res.json(serialize(existing));
    }
    throw error;
  }
};

exports.getMyBookings = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const query = { $or: [{ requester: req.userId }, { provider: req.userId }] };
  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate('requester', 'name profilePicture timezone')
      .populate('provider', 'name profilePicture timezone')
      .sort({ proposedTime: -1 }).skip((page - 1) * limit).limit(limit),
    Booking.countDocuments(query)
  ]);
  res.set('X-Total-Count', String(total)).json(bookings.map(serialize));
};

exports.updateBookingStatus = async (req, res) => {
  const { status } = req.body;
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new HttpError(400, 'Invalid booking id');
  if (!['accepted', 'declined'].includes(status)) throw new HttpError(400, 'Status must be accepted or declined');
  const booking = status === 'accepted' ? await acceptBooking(req.params.id, req.userId) : await declineBooking(req.params.id, req.userId);
  res.json(serialize(booking));
};

exports.cancelBooking = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new HttpError(400, 'Invalid booking id');
  const booking = await closeBooking(req.params.id, { status: 'cancelled', byUserId: req.userId, reason: req.body?.reason });
  res.json(serialize(booking));
};

exports.completeBooking = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new HttpError(400, 'Invalid booking id');
  const { booking, cost } = await settleBooking(req.params.id, { byUserId: req.userId });
  res.json({ message: `Session confirmed. ${cost} credit${cost === 1 ? '' : 's'} transferred.`, booking: serialize(booking) });
};

exports.serialize = serialize;
