const mongoose = require('mongoose');

/**
 * Credit ledger. A session settlement moves `amount` credits from the learner,
 * of which `fee` is kept by the platform; purchases and grants have no `from`.
 */
const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['session', 'purchase', 'subscription_grant', 'signup_bonus', 'adjustment'],
    default: 'session'
  },
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: { type: Number, required: true },
  fee: { type: Number, default: 0 },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  description: { type: String, maxlength: 200, default: '' },
  createdAt: { type: Date, default: Date.now }
});

transactionSchema.index({ booking: 1 }, { unique: true, sparse: true }); // one settlement per booking
transactionSchema.index({ from: 1, createdAt: -1 });
transactionSchema.index({ to: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
