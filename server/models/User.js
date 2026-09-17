const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // will store the HASHED password, never plain text
  skillsOffered: [{ type: String }],   // e.g. ["Guitar", "Excel"]
  skillsWanted: [{ type: String }],    // e.g. ["Cooking", "Spanish"]
  creditBalance: { type: Number, default: 5 }, // everyone starts with 5 free credits
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);