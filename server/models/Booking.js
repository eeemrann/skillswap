const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  firstJoinedAt: Date,
  lastLeftAt: Date,
  totalSeconds: { type: Number, default: 0 }
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // the learner, who pays
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // the teacher, who earns
  skill: { type: String, required: true, trim: true, maxlength: 80 },
  note: { type: String, trim: true, maxlength: 500, default: '' },
  proposedTime: { type: Date, required: true },
  durationMinutes: { type: Number, min: 15, max: 480, default: 60 },
  credits: { type: Number, min: 0 }, // price of the session; legacy bookings have none (treated as 1)
  idempotencyKey: { type: String, maxlength: 100 },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'cancelled', 'expired', 'completed'],
    default: 'pending'
  },
  // Credits are reserved from the learner when the teacher accepts.
  escrow: { type: String, enum: ['none', 'held', 'settled', 'released'], default: 'none' },
  roomId: { type: String, index: true }, // unguessable id of the video room
  attendance: [attendanceSchema],
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelReason: { type: String, trim: true, maxlength: 300 },
  completedAt: Date,
  autoCompleted: { type: Boolean, default: false },
  reminderSentAt: Date
}, { timestamps: true });

bookingSchema.index(
  { requester: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
bookingSchema.index({ provider: 1, proposedTime: 1, status: 1 });
bookingSchema.index({ requester: 1, proposedTime: 1, status: 1 });
bookingSchema.index({ status: 1, proposedTime: 1 });

bookingSchema.virtual('endsAt').get(function endsAt() {
  return new Date(this.proposedTime.getTime() + (this.durationMinutes || 60) * 60000);
});

module.exports = mongoose.model('Booking', bookingSchema);
