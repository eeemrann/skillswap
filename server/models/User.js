const mongoose = require('mongoose');
const { signupCredits } = require('../config/plans');

const locationSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: undefined },
  coordinates: { type: [Number], default: undefined },
  city: { type: String, default: '' },
  country: { type: String, default: '' },
  lastUpdated: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  clerkId: { type: String, unique: true, sparse: true },
  profilePicture: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  bio: { type: String, maxlength: 500, default: '' },
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

  // Credits: 1 credit = 1 hour of video time.
  creditBalance: { type: Number, default: () => signupCredits() },
  creditsHeld: { type: Number, default: 0 }, // reserved for accepted, unsettled bookings

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

module.exports = mongoose.model('User', userSchema);
