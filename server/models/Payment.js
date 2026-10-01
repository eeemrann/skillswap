const mongoose = require('mongoose');

/** Money received through Stripe. `externalId` makes webhook fulfilment idempotent. */
const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['credit_pack', 'subscription'], required: true },
  externalId: { type: String, required: true, unique: true }, // checkout session id or invoice id
  description: { type: String, maxlength: 200, default: '' },
  credits: { type: Number, default: 0 },
  amountCents: { type: Number, required: true },
  currency: { type: String, default: 'usd' },
  receiptUrl: { type: String, default: '' }
}, { timestamps: true });

paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
