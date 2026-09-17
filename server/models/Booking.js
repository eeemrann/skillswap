const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who's asking to learn
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // who's teaching
  skill: { type: String, required: true },        // e.g. "Guitar"
  proposedTime: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'completed'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);