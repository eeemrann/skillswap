const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const validator = require('validator');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client();
const createToken = (user) => jwt.sign(
  { userId: user._id, role: user.role || 'user' },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role || 'user',
  profilePicture: user.profilePicture || ''
});

// REGISTER a new user
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// LOGIN an existing user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'This account uses Google sign-in' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'This account has been suspended' });
    }

    const token = createToken(user);

    res.json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// SIGN IN or REGISTER with a verified Google ID token
exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: 'Google credential is required' });
    if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ message: 'Google sign-in is not configured' });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({ message: 'Google account email could not be verified' });
    }

    const email = payload.email.trim().toLowerCase();
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name: payload.name?.trim() || email.split('@')[0],
        email,
        authProvider: 'google',
        googleId: payload.sub,
        profilePicture: payload.picture || ''
      });
    } else {
      if (user.status === 'suspended') return res.status(403).json({ message: 'This account has been suspended' });
      let changed = false;
      if (!user.googleId) { user.googleId = payload.sub; changed = true; }
      if (payload.picture && user.profilePicture !== payload.picture) { user.profilePicture = payload.picture; changed = true; }
      if (changed) await user.save();
    }

    const token = createToken(user);
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    return res.status(401).json({ message: 'Google sign-in failed. Please try again.', error: err.message });
  }
};
