const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  emailVerified: { type: Boolean, default: false },
  emailVerificationCodeHash: { type: String, select: false },
  emailVerificationExpires: { type: Date, select: false },
  password: { type: String, required: function () { return this.authProvider !== 'google'; } }, // hashed; optional for Google-only accounts
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  googleId: { type: String, unique: true, sparse: true },
  profilePicture: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  tokenVersion: { type: Number, default: 0, select: false },
  bio: { type: String, maxlength: 500, default: '' },
  skillsOffered: [{ type: String, trim: true, maxlength: 80 }],
  skillsWanted: [{ type: String, trim: true, maxlength: 80 }],
  location: {
    city: { type: String, default: '' },
    country: { type: String, default: '' },
    coordinates: { lat: Number, lng: Number }
  },
  timezone: { type: String, default: 'UTC' },
  availability: [{
    day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
    start: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    end: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ }
  }],
  creditBalance: { type: Number, default: 5 }, // everyone starts with 5 free credits
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
