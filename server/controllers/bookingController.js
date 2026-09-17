const Booking = require('../models/Booking');

// CREATE a booking request
exports.createBooking = async (req, res) => {
  try {
    const { providerId, skill, proposedTime } = req.body;

    const booking = new Booking({
      requester: req.userId,   // comes from the auth middleware
      provider: providerId,
      skill,
      proposedTime
    });

    await booking.save();
    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
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
    const { status } = req.body; // "accepted" or "declined"
    const booking = await Booking.findById(req.params.id);

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Only the provider (the one being asked to teach) can accept/decline
    if (booking.provider.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to update this booking' });
    }

    booking.status = status;
    await booking.save();

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const User = require('../models/User');
const Transaction = require('../models/Transaction');

// COMPLETE a booking — transfers 1 credit from requester to provider
exports.completeBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Only the requester (the learner) confirms the session actually happened
    if (booking.requester.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only the requester can mark this complete' });
    }

    if (booking.status !== 'accepted') {
      return res.status(400).json({ message: 'Only accepted bookings can be completed' });
    }

    const requester = await User.findById(booking.requester);
    const provider = await User.findById(booking.provider);

    const CREDIT_COST = 1; // flat rate for now — could later scale with session length

    if (requester.creditBalance < CREDIT_COST) {
      return res.status(400).json({ message: 'Insufficient credits to complete this booking' });
    }

    // Move the credits
    requester.creditBalance -= CREDIT_COST;
    provider.creditBalance += CREDIT_COST;
    await requester.save();
    await provider.save();

    // Record it
    await Transaction.create({
      from: requester._id,
      to: provider._id,
      amount: CREDIT_COST,
      booking: booking._id
    });

    booking.status = 'completed';
    await booking.save();

    res.json({ message: 'Booking completed, credits transferred', booking });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};