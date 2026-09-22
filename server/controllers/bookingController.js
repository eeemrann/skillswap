const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { queueEmail, createInAppNotification } = require('../services/notificationService');

exports.createBooking = async (req, res) => {
  const idempotencyKey = String(req.get('Idempotency-Key') || '').trim();
  try {
    const providerId = String(req.body.providerId || '');
    const skill = String(req.body.skill || '').trim();
    const durationMinutes = Number(req.body.durationMinutes || 60);
    if (!idempotencyKey || !/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey)) return res.status(400).json({ message: 'A valid Idempotency-Key header is required' });
    if (!mongoose.Types.ObjectId.isValid(providerId)) return res.status(400).json({ message: 'Invalid provider id' });
    if (new mongoose.Types.ObjectId(providerId).equals(req.userId)) return res.status(400).json({ message: 'You cannot book a session with yourself' });
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) return res.status(400).json({ message: 'Duration must be between 15 and 480 minutes' });
    const previous = await Booking.findOne({ requester: req.userId, idempotencyKey });
    if (previous) return res.json(previous);
    const provider = await User.findById(providerId);
    if (!provider) return res.status(404).json({ message: 'Provider not found' });
    if (provider.status === 'suspended') return res.status(403).json({ message: 'This provider is unavailable' });
    if (!provider.skillsOffered.some((item) => item.toLowerCase() === skill.toLowerCase())) return res.status(400).json({ message: 'This provider does not offer that skill' });
    const time = new Date(req.body.proposedTime);
    if (Number.isNaN(time.getTime()) || time <= new Date()) return res.status(400).json({ message: 'Proposed time must be a valid future date' });
    const end = new Date(time.getTime() + durationMinutes * 60000);
    const conflict = await Booking.findOne({
      status: { $in: ['pending', 'accepted'] },
      $or: [{ requester: req.userId }, { provider: req.userId }, { requester: providerId }, { provider: providerId }],
      $expr: { $and: [
        { $lt: ['$proposedTime', end] },
        { $gt: [{ $add: ['$proposedTime', { $multiply: [{ $ifNull: ['$durationMinutes', 60] }, 60000] }] }, time] }
      ] }
    });
    if (conflict) return res.status(409).json({ message: 'This time overlaps an existing booking' });
    const booking = await Booking.create({ requester: req.userId, provider: providerId, skill, proposedTime: time, durationMinutes, idempotencyKey });
    const requester = await User.findById(req.userId).select('name');
    const actor = requester?.name || 'A SkillSwap member';
    await Promise.all([
      createInAppNotification({ userId: provider._id, type: 'booking', message: `${actor} requested a skill swap with you`, relatedId: booking._id }),
      queueEmail('BOOKING_CREATED', provider.email, { actor, skill, time: time.toISOString() })
    ]);
    return res.status(201).json(booking);
  } catch (error) {
    if (error.code === 11000) {
      const existing = await Booking.findOne({ requester: req.userId, idempotencyKey });
      if (existing) return res.json(existing);
    }
    console.error('Booking creation failed:', error.message);
    return res.status(500).json({ message: 'Booking could not be created' });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const query = { $or: [{ requester: req.userId }, { provider: req.userId }] };
    const [bookings, total] = await Promise.all([
      Booking.find(query).populate('requester', 'name email').populate('provider', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Booking.countDocuments(query)
    ]);
    return res.set('X-Total-Count', String(total)).json(bookings);
  } catch (error) {
    console.error('Booking list failed:', error.message);
    return res.status(500).json({ message: 'Bookings could not be loaded' });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const status = req.body.status;
    if (!['accepted', 'declined'].includes(status)) return res.status(400).json({ message: 'Status must be accepted or declined' });
    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Booking not found' });
    if (existing.provider.toString() !== req.userId) return res.status(403).json({ message: 'Not authorized to update this booking' });
    if (status === 'accepted') {
      const end = new Date(existing.proposedTime.getTime() + existing.durationMinutes * 60000);
      const conflict = await Booking.findOne({
        _id: { $ne: existing._id },
        status: { $in: ['pending', 'accepted'] },
        $or: [
          { requester: existing.requester }, { provider: existing.requester },
          { requester: existing.provider }, { provider: existing.provider }
        ],
        $expr: { $and: [
          { $lt: ['$proposedTime', end] },
          { $gt: [{ $add: ['$proposedTime', { $multiply: [{ $ifNull: ['$durationMinutes', 60] }, 60000] }] }, existing.proposedTime] }
        ] }
      });
      if (conflict) return res.status(409).json({ message: 'This time overlaps an existing booking' });
    }
    const booking = await Booking.findOneAndUpdate({ _id: req.params.id, status: 'pending' }, { status }, { new: true, runValidators: true });
    if (!booking) return res.status(409).json({ message: 'Only pending bookings can be accepted or declined' });
    const [requester, provider] = await Promise.all([User.findById(booking.requester).select('email'), User.findById(booking.provider).select('name')]);
    await Promise.all([
      createInAppNotification({ userId: requester._id, type: 'booking', message: status === 'accepted' ? 'Your booking request was accepted' : 'Your booking request was declined', relatedId: booking._id }),
      queueEmail(status === 'accepted' ? 'BOOKING_ACCEPTED' : 'BOOKING_DECLINED', requester.email, { actor: provider.name, skill: booking.skill, time: booking.proposedTime.toISOString() })
    ]);
    return res.json(booking);
  } catch (error) {
    console.error('Booking status update failed:', error.message);
    return res.status(500).json({ message: 'Booking could not be updated' });
  }
};

exports.completeBooking = async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking) { await session.abortTransaction(); return res.status(404).json({ message: 'Booking not found' }); }
    if (booking.requester.toString() !== req.userId) { await session.abortTransaction(); return res.status(403).json({ message: 'Only the requester can mark this complete' }); }
    if (booking.status !== 'accepted') { await session.abortTransaction(); return res.status(409).json({ message: 'Only accepted bookings can be completed' }); }
    const [requester, provider] = await Promise.all([User.findById(booking.requester).session(session), User.findById(booking.provider).session(session)]);
    if (requester.creditBalance < 1) { await session.abortTransaction(); return res.status(400).json({ message: 'Insufficient credits to complete this booking' }); }
    requester.creditBalance -= 1;
    provider.creditBalance += 1;
    await Promise.all([requester.save({ session }), provider.save({ session })]);
    await Transaction.create([{ from: requester._id, to: provider._id, amount: 1, booking: booking._id }], { session });
    booking.status = 'completed';
    await booking.save({ session });
    await session.commitTransaction();
    await Promise.all([
      createInAppNotification({ userId: provider._id, type: 'booking', message: 'Your skill exchange was completed', relatedId: booking._id }),
      createInAppNotification({ userId: provider._id, type: 'credit', message: 'You received 1 credit for a completed exchange', relatedId: booking._id }),
      createInAppNotification({ userId: requester._id, type: 'credit', message: '1 credit was used for your completed exchange', relatedId: booking._id }),
      queueEmail('BOOKING_COMPLETED', provider.email, { actor: requester.name, skill: booking.skill })
    ]);
    return res.json({ message: 'Booking completed, credits transferred', booking });
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    console.error('Booking completion failed:', error.message);
    return res.status(500).json({ message: 'Booking could not be completed' });
  } finally {
    if (session) await session.endSession();
  }
};
