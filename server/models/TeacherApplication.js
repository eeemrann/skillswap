const mongoose = require('mongoose');

const CREDENTIAL_KINDS = ['degree', 'certification', 'employment', 'publication', 'portfolio'];
const TEACHER_TYPES = ['university_lecturer', 'industry_professional', 'certified_trainer', 'independent_expert'];

const credentialSchema = new mongoose.Schema({
  kind: { type: String, enum: CREDENTIAL_KINDS, required: true },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  issuer: { type: String, required: true, trim: true, maxlength: 140 },
  year: { type: Number, min: 1950, max: 2100 },
  url: { type: String, trim: true, maxlength: 500, default: '' }, // where a reviewer can verify it
  credentialId: { type: String, trim: true, maxlength: 100, default: '' }
}, { _id: false });

/**
 * A request to become a verified teacher. One document per member: it is edited in place when
 * they re-apply after a rejection, or when a verified teacher asks to add more skills.
 * Only an administrator can approve it, and approval is the only way to start teaching.
 */
const teacherApplicationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'revoked'], default: 'pending', index: true },
  teacherType: { type: String, enum: TEACHER_TYPES, required: true },
  headline: { type: String, required: true, trim: true, maxlength: 120 },
  statement: { type: String, required: true, trim: true, minlength: 40, maxlength: 1500 }, // teaching experience, in their words
  organization: { type: String, trim: true, maxlength: 120, default: '' },
  jobTitle: { type: String, trim: true, maxlength: 120, default: '' },
  yearsExperience: { type: Number, min: 0, max: 60, default: 0 },
  skills: [{ type: String, trim: true, maxlength: 80 }],
  proposedRateCredits: { type: Number, min: 0.5, max: 20, default: 1 },
  credentials: { type: [credentialSchema], default: [] },
  links: {
    _id: false,
    linkedin: { type: String, trim: true, maxlength: 300, default: '' },
    github: { type: String, trim: true, maxlength: 300, default: '' },
    website: { type: String, trim: true, maxlength: 300, default: '' },
    institutionProfile: { type: String, trim: true, maxlength: 300, default: '' } // staff page, faculty listing…
  },
  institutionalEmail: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
  institutionalEmailVerified: { type: Boolean, default: false },

  submittedAt: { type: Date, default: Date.now },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewNotes: { type: String, trim: true, maxlength: 1000, default: '' }, // internal
  decisionReason: { type: String, trim: true, maxlength: 500, default: '' }, // shown to the applicant on rejection or revocation
  approvedSkills: [{ type: String, trim: true, maxlength: 80 }],
  tier: { type: String, enum: ['standard', 'expert'], default: 'standard' }
}, { timestamps: true });

teacherApplicationSchema.index({ status: 1, submittedAt: 1 });

module.exports = mongoose.model('TeacherApplication', teacherApplicationSchema);
module.exports.CREDENTIAL_KINDS = CREDENTIAL_KINDS;
module.exports.TEACHER_TYPES = TEACHER_TYPES;
