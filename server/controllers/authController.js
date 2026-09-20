const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const validator = require('validator');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const { notify } = require('../services/notificationService');

const googleClient = new OAuth2Client();
const VERIFICATION_TTL_MS = 10 * 60 * 1000;
const normalizeEmail = (email = '') => String(email).trim().toLowerCase();
const hashVerificationCode = (code) => crypto.createHash('sha256').update(code).digest('hex');
const issueVerificationCode = (user) => {
  const code = crypto.randomInt(100000, 1000000).toString();
  user.emailVerificationCodeHash = hashVerificationCode(code);
  user.emailVerificationExpires = new Date(Date.now() + VERIFICATION_TTL_MS);
  return code;
};
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
    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);

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

    const newUser = new User({ name: String(name || '').trim(), email, password: hashedPassword, emailVerified: false });
    const verificationCode = issueVerificationCode(newUser);
    await newUser.save();

    const delivery = await notify('EMAIL_VERIFICATION', newUser.email, {
      actor: newUser.name,
      code: verificationCode,
      minutes: Math.floor(VERIFICATION_TTL_MS / 60000)
    });

    res.status(201).json({
      message: delivery.delivered
        ? 'Account created. Check your email for the verification code.'
        : 'Account created, but the verification email could not be delivered. Please resend the code.',
      requiresVerification: true,
      email: newUser.email
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// LOGIN an existing user
exports.login = async (req, res) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

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

    // Older accounts predate email verification and have this field undefined.
    // Only accounts explicitly registered as unverified are blocked.
    if (user.emailVerified === false) {
      return res.status(403).json({ message: 'Verify your email before signing in', requiresVerification: true, email: user.email });
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
        profilePicture: payload.picture || '',
        emailVerified: true
      });
    } else {
      if (user.status === 'suspended') return res.status(403).json({ message: 'This account has been suspended' });
      let changed = false;
      if (!user.googleId) { user.googleId = payload.sub; changed = true; }
      if (user.emailVerified !== true) { user.emailVerified = true; changed = true; }
      if (payload.picture && user.profilePicture !== payload.picture) { user.profilePicture = payload.picture; changed = true; }
      if (changed) await user.save();
    }

    const token = createToken(user);
    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    return res.status(401).json({ message: 'Google sign-in failed. Please try again.', error: err.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || '').trim();
    if (!validator.isEmail(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: 'A valid email and 6-digit code are required' });
    }

    const user = await User.findOne({ email }).select('+emailVerificationCodeHash +emailVerificationExpires');
    if (!user) return res.status(400).json({ message: 'Invalid or expired verification code' });
    if (user.emailVerified) return res.json({ message: 'Email is already verified' });
    const validCode = user.emailVerificationCodeHash === hashVerificationCode(code);
    const unexpired = user.emailVerificationExpires && user.emailVerificationExpires > new Date();
    if (!validCode || !unexpired) return res.status(400).json({ message: 'Invalid or expired verification code' });

    user.emailVerified = true;
    user.emailVerificationCodeHash = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    return res.json({ message: 'Email verified successfully. You can now sign in.' });
  } catch (err) {
    return res.status(500).json({ message: 'Email verification failed', error: err.message });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!validator.isEmail(email)) return res.status(400).json({ message: 'A valid email is required' });
    const user = await User.findOne({ email }).select('+emailVerificationCodeHash +emailVerificationExpires');
    if (!user || user.emailVerified) {
      return res.json({ message: 'If this account needs verification, a new code has been sent.' });
    }
    const code = issueVerificationCode(user);
    await user.save();
    const delivery = await notify('EMAIL_VERIFICATION', user.email, {
      actor: user.name,
      code,
      minutes: Math.floor(VERIFICATION_TTL_MS / 60000)
    });
    if (!delivery.delivered) return res.status(502).json({ message: 'Verification email could not be delivered. Please try again.' });
    return res.json({ message: 'A new verification code was sent.' });
  } catch (err) {
    return res.status(500).json({ message: 'Could not resend verification email', error: err.message });
  }
};
