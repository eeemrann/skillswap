const mongoose = require('mongoose');
const { signupCredits } = require('../config/plans');

const locationSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: undefined },
  coordinates: { type: [Number], default: undefined },
  city: { type: String, default: '' },
  country: { type: String, default: '' },
  lastUpdated: { type: Date, default: Date.now }
}, { _id: false });

// Verified teaching details, copied from the approved application. Credential summaries are public;
// document numbers and review notes stay on the application.
const teacherProfileSchema = new mongoose.Schema({
  teacherType: { type: String, enum: ['university_lecturer', 'industry_professional', 'certified_trainer', 'independent_expert'] },
  tier: { type: String, enum: ['standard', 'expert'], default: 'standard' },
  headline: { type: String, trim: true, maxlength: 120, default: '' },
  organization: { type: String, trim: true, maxlength: 120, default: '' },
  jobTitle: { type: String, trim: true, maxlength: 120, default: '' },
  yearsExperience: { type: Number, min: 0, max: 60, default: 0 },
  hourlyRateCredits: { type: Number, min: 0.5, max: 20, default: 1 }, // price of one hour, in credits
  institutionalEmailVerified: { type: Boolean, default: false },
  verifiedAt: Date,
  credentials: [{ _id: false, kind: String, title: String, issuer: String, year: Number }]
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  clerkId: { type: String, unique: true, sparse: true },
  profilePicture: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  bio: { type: String, maxlength: 500, default: '' },
  // Tech skills from config/catalog.js. `skillsOffered` can only hold skills an administrator
  // verified for this member (`verifiedSkills`); learners just list what they want to learn.
  skillsOffered: [{ type: String, trim: true, maxlength: 80 }],
  skillsWanted: [{ type: String, trim: true, maxlength: 80 }],
  languages: [{ type: String, trim: true, maxlength: 40 }],
  location: { type: locationSchema, default: undefined },
  timezone: { type: String, default: 'UTC' },
  availability: [{
    _id: false,
    day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
    start: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    end: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ }
  }],

  // Teaching: only members whose credentials an administrator verified can be booked.
  teacherStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected', 'revoked'], default: 'none' },
  verifiedSkills: [{ type: String, trim: true, maxlength: 80 }],
  teacherProfile: { type: teacherProfileSchema, default: undefined },

  // Credits are the platform currency. Learners buy them (or get welcome credits), teachers earn them.
  creditBalance: { type: Number, default: () => signupCredits() }, // everything spendable on sessions, earned credits included
  creditsHeld: { type: Number, default: 0 }, // reserved for accepted, unsettled bookings
  // Part of creditBalance that was earned by teaching, the only part that can be cashed out.
  earnedCredits: { type: Number, default: 0 },
  // Lifetime earned credits that were spent on lessons or withdrawn; earnings clear in first-in-first-out order.
  earnedUsed: { type: Number, default: 0 },

  // Payouts (Stripe Connect Express). Money only ever leaves the platform through here.
  stripeConnectId: { type: String, unique: true, sparse: true },
  payoutsEnabled: { type: Boolean, default: false }, // mirrors the Connect account's payouts_enabled
  payoutsBlocked: { type: Boolean, default: false }, // set by an administrator (fraud review, chargeback)
  payoutsBlockedReason: { type: String, maxlength: 200, default: '' },

  // Subscription (mirrors Stripe; the webhook is the only writer).
  plan: { type: String, enum: ['free', 'pro'], default: 'free' },
  planStatus: { type: String, default: 'active' },
  planInterval: { type: String, enum: ['month', 'year', null], default: null },
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false },
  stripeCustomerId: { type: String, unique: true, sparse: true },
  stripeSubscriptionId: { type: String, unique: true, sparse: true },

  createdAt: { type: Date, default: Date.now }
});

// Partial: a profile may have a city/country but no coordinates, and such a
// location is not valid GeoJSON, so only documents holding a Point are indexed.
userSchema.index({ location: '2dsphere' }, { partialFilterExpression: { 'location.type': 'Point' } });
userSchema.index({ status: 1, createdAt: -1 });
userSchema.index({ teacherStatus: 1, status: 1 });

module.exports = mongoose.model('User', userSchema);
