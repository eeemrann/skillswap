const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client();
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
