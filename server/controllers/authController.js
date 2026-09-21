const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const validator = require('validator');
const { OAuth2Client } = require('google-auth-library');
const dns = require('dns').promises;

const googleClient = new OAuth2Client();
const normalizeEmail = (email = '') => String(email).trim().toLowerCase();
const DISPOSABLE_DOMAINS = new Set(['mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'yopmail.com', 'throwawaymail.com']);
const validateDeliverableEmail = async (email) => {
  if (!validator.isEmail(email, { allow_utf8_local_part: false })) return false;
  const domain = email.split('@')[1];
  const configured = String(process.env.BLOCKED_EMAIL_DOMAINS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (DISPOSABLE_DOMAINS.has(domain) || configured.includes(domain)) return false;
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DNS timeout')), 3000))
    ]);
    return records.length > 0;
  } catch (_) {
    return false;
  }
};
const createToken = (user) => jwt.sign(
  { userId: user._id, role: user.role || 'user', tokenVersion: user.tokenVersion || 0 },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
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
    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!await validateDeliverableEmail(email)) {
      return res.status(400).json({ message: 'Use a valid, deliverable email address. Temporary email services are not allowed.' });
    }
    if (!name || !String(name).trim() || String(name).trim().length > 80) {
      return res.status(400).json({ message: 'Name is required and must be 80 characters or fewer' });
    }
    if (!password || password.length < 8 || Buffer.byteLength(password) > 72) {
      return res.status(400).json({ message: 'Password must be 8 to 72 bytes long' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ name: String(name || '').trim(), email, password: hashedPassword });
    await newUser.save();
    const token = createToken(newUser);
    res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: publicUser(newUser)
    });
  } catch (err) {
    console.error('Authentication request failed:', err.message);
    res.status(500).json({ message: 'Authentication request could not be completed' });
  }
};

// LOGIN an existing user
exports.login = async (req, res) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

    const user = await User.findOne({ email }).select('+tokenVersion');
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
    console.error('Authentication request failed:', err.message);
    res.status(500).json({ message: 'Authentication request could not be completed' });
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
    console.error('Google sign-in failed:', err.message);
    return res.status(401).json({ message: 'Google sign-in failed. Please try again.' });
  }
};

exports.logout = async (req, res) => {
  await User.findByIdAndUpdate(req.userId, { $inc: { tokenVersion: 1 } });
  return res.json({ message: 'Signed out successfully' });
};
