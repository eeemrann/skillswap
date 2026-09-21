const mongoose = require('mongoose');

const emailJobSchema = new mongoose.Schema({
  type: { type: String, required: true, trim: true },
  recipientEmail: { type: String, required: true, trim: true, lowercase: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['pending', 'processing', 'sent', 'dead'], default: 'pending', index: true },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  lastError: { type: String, default: '' },
  sentAt: Date,
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
}, { timestamps: true });

emailJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
emailJobSchema.index({ status: 1, nextAttemptAt: 1 });

module.exports = mongoose.model('EmailJob', emailJobSchema);
