const { getAuth, clerkClient } = require('@clerk/express');
const User = require('../models/User');

// Verifies Clerk's JWT, then maps the Clerk identity to the existing Mongo user.
module.exports = async function auth(req, res, next) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ message: 'Authentication required' });

    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses?.find((item) => item.id === clerkUser.primaryEmailAddressId)?.emailAddress
      || clerkUser.emailAddresses?.[0]?.emailAddress;
    if (!email) return res.status(401).json({ message: 'Your Clerk account has no email address' });

    let user = await User.findOne({ clerkId: userId });
    if (!user) {
      user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        user.clerkId = userId;
        user.authProvider = 'clerk';
        await user.save();
      } else {
        user = await User.create({ clerkId: userId, email: email.toLowerCase(), name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || 'SkillSwap member', authProvider: 'clerk', password: undefined, profilePicture: clerkUser.imageUrl || '' });
      }
    }
    if (user.status === 'suspended') return res.status(403).json({ message: 'This account has been suspended' });
    req.userId = user._id.toString();
    req.userRole = user.role || 'user';
    req.clerkUserId = userId;
    next();
  } catch (err) {
    console.error('Clerk auth failed:', err.message);
    return res.status(401).json({ message: 'Invalid or expired Clerk session' });
  }
};

module.exports.requireAdmin = function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};
