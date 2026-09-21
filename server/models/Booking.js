const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who's asking to learn
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // who's teaching
  skill: { type: String, required: true, trim: true, maxlength: 80 },
  proposedTime: { type: Date, required: true },
  durationMinutes: { type: Number, min: 15, max: 480, default: 60 },
  idempotencyKey: { type: String, maxlength: 100 },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'completed'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now }
});

bookingSchema.index(
  { requester: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
bookingSchema.index({ provider: 1, proposedTime: 1, status: 1 });
bookingSchema.index({ requester: 1, proposedTime: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
