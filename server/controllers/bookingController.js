const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
// CREATE a booking request
exports.createBooking = async (req, res) => {
  try {
    const { providerId, skill, proposedTime } = req.body;

    // Prevent booking yourself
    if (providerId === req.userId) {
      return res.status(400).json({
        message: 'You cannot book a session with yourself'
      });
    }

    // Check provider exists
    const provider = await User.findById(providerId);

    if (!provider) {
      return res.status(404).json({
        message: 'Provider not found'
      });
    }

    // Check provider actually offers the skill
    if (!provider.skillsOffered.includes(skill)) {
      return res.status(400).json({
        message: 'This provider does not offer that skill'
      });
    }

    // Validate date
    const time = new Date(proposedTime);

    if (isNaN(time.getTime()) || time < new Date()) {
      return res.status(400).json({
        message: 'Proposed time must be a valid future date'
      });
    }

    const booking = new Booking({
      requester: req.userId,
      provider: providerId,
      skill,
      proposedTime: time
    });

    await booking.save();

    res.status(201).json(booking);

  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};

// GET all bookings involving the logged-in user (either side)
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      $or: [{ requester: req.userId }, { provider: req.userId }]
    })
      .populate('requester', 'name email')
      .populate('provider', 'name email')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// UPDATE a booking's status (accept/decline) — only the provider can do this
exports.updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowed = ['accepted', 'declined'];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: 'Status must be accepted or declined'
      });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found'
      });
    }

    // Only provider can accept/decline
    if (booking.provider.toString() !== req.userId) {
      return res.status(403).json({
        message: 'Not authorized to update this booking'
      });
    }

    // Only pending bookings can change
    if (booking.status !== 'pending') {
      return res.status(400).json({
        message: 'Only pending bookings can be accepted or declined'
      });
    }

    booking.status = status;

    await booking.save();

    res.json(booking);

  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};

// COMPLETE a booking — transfers 1 credit from requester to provider
exports.completeBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (booking.requester.toString() !== req.userId) {
      await session.abortTransaction();
      return res.status(403).json({ message: 'Only the requester can mark this complete' });
    }
    if (booking.status !== 'accepted') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Only accepted bookings can be completed' });
    }

    const requester = await User.findById(booking.requester).session(session);
    const provider = await User.findById(booking.provider).session(session);

    const CREDIT_COST = 1;
    if (requester.creditBalance < CREDIT_COST) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Insufficient credits to complete this booking' });
    }

    requester.creditBalance -= CREDIT_COST;
    provider.creditBalance += CREDIT_COST;
    await requester.save({ session });
    await provider.save({ session });

    await Transaction.create(
      [{ from: requester._id, to: provider._id, amount: CREDIT_COST, booking: booking._id }],
      { session }
    );

    booking.status = 'completed';
    await booking.save({ session });

    await session.commitTransaction();
    session.endSession();
    res.json({ message: 'Booking completed, credits transferred', booking });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};