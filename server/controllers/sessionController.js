const mongoose = require('mongoose');
const { Booking } = require('../models');
const { HttpError } = require('../utils/transaction');
const { evaluateAccess, buildIceServers } = require('../services/sessionService');

/** Everything the browser needs before it opens the video room. */
exports.getSession = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.bookingId)) throw new HttpError(400, 'Invalid booking id');
  const booking = await Booking.findById(req.params.bookingId)
    .populate('requester', 'name profilePicture timezone')
    .populate('provider', 'name profilePicture timezone');
  if (!booking) throw new HttpError(404, 'Session not found');

  const access = evaluateAccess(booking, req.userId);
  if (access.code === 'FORBIDDEN') throw new HttpError(403, access.message);

  const iAmLearner = String(booking.requester._id) === String(req.userId);
  const peer = iAmLearner ? booking.provider : booking.requester;
  res.json({
    booking: {
      _id: booking._id,
      skill: booking.skill,
      note: booking.note,
      status: booking.status,
      durationMinutes: booking.durationMinutes,
      credits: booking.credits ?? 1,
      role: iAmLearner ? 'learner' : 'teacher'
    },
    peer: { _id: peer._id, name: peer.name, profilePicture: peer.profilePicture, timezone: peer.timezone },
    access: { ok: access.ok, code: access.code, message: access.message },
    window: { startsAt: access.startsAt, endsAt: access.endsAt, opensAt: access.opensAt, closesAt: access.closesAt },
    iceServers: access.ok ? buildIceServers(req.userId) : [],
    serverTime: new Date().toISOString()
  });
};
