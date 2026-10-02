const mongoose = require('mongoose');

/**
 * A cash-out of earned credits. Credits leave the wallet when the payout is created and come back
 * if it fails or is rejected, so the ledger and the money can never disagree.
 *
 *   pending_review -> processing -> paid
 *        |                |-> failed (credits restored)
 *        |-> rejected (credits restored)
 */
const payoutSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  credits: { type: Number, required: true, min: 0 },
  amountCents: { type: Number, required: true, min: 0 },
  rateCentsPerCredit: { type: Number, required: true },
  currency: { type: String, default: 'usd' },
  status: { type: String, enum: ['pending_review', 'processing', 'paid', 'failed', 'rejected'], default: 'processing', index: true },
  stripeTransferId: { type: String, default: '' },
  failureReason: { type: String, maxlength: 300, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  paidAt: Date,
  attempts: { type: Number, default: 0 }
}, { timestamps: true });

payoutSchema.index({ user: 1, createdAt: -1 });
payoutSchema.index({ status: 1, updatedAt: 1 });

module.exports = mongoose.model('Payout', payoutSchema);
