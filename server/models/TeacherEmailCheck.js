const mongoose = require('mongoose');

/**
 * A one-time code mailed to a teacher applicant's university or employer address.
 * It proves they control that mailbox, which is the strongest cheap signal for lecturers and staff.
 */
const teacherEmailCheckSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  verifiedAt: Date,
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

teacherEmailCheckSchema.index({ user: 1, email: 1 }, { unique: true });
teacherEmailCheckSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('TeacherEmailCheck', teacherEmailCheckSchema);
