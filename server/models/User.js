const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: function () { return this.authProvider !== 'google'; } }, // hashed; optional for Google-only accounts
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  googleId: { type: String, unique: true, sparse: true },
  profilePicture: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  bio: { type: String, maxlength: 500, default: '' },
  skillsOffered: [{ type: String }],   // e.g. ["Guitar", "Excel"]
  skillsWanted: [{ type: String }],    // e.g. ["Cooking", "Spanish"]
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
