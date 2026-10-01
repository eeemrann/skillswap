const { getAuth, clerkClient } = require('@clerk/express');
const { User, Transaction } = require('../models');
const { signupCredits } = require('../config/plans');

const primaryEmailOf = (clerkUser) => clerkUser.emailAddresses?.find((item) => item.id === clerkUser.primaryEmailAddressId)
  || clerkUser.emailAddresses?.[0];

/**
 * Creates (or links by email) the application profile for a Clerk identity.
 * Only verified addresses receive a profile, so unverified sign-ups cannot farm credits.
 */
async function provisionUser(clerkUserId) {
  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const primary = primaryEmailOf(clerkUser);
  if (!primary?.emailAddress) return { error: { status: 401, message: 'Your account has no email address' } };
  if (primary.verification?.status && primary.verification.status !== 'verified') {
    return { error: { status: 403, message: 'Please verify your email address to continue', code: 'EMAIL_NOT_VERIFIED' } };
  }

  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || clerkUser.username || 'SkillSwap member';
  const email = primary.emailAddress.toLowerCase();
  const bonus = signupCredits();
  try {
    const result = await User.findOneAndUpdate(
      { email },
      {
        $set: { clerkId: clerkUserId },
        $setOnInsert: { name, email, profilePicture: clerkUser.imageUrl || '', creditBalance: bonus, skillsOffered: [], skillsWanted: [], status: 'active' }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, includeResultMetadata: true }
    );
    if (result.lastErrorObject?.upserted && bonus > 0) {
      await Transaction.create({ type: 'signup_bonus', to: result.value._id, amount: bonus, description: 'Welcome credits' })
        .catch((error) => console.error('Signup bonus ledger entry failed:', error.message));
    }
    return { user: result.value };
  } catch (error) {
    if (error.code !== 11000) throw error;
    const user = await User.findOne({ $or: [{ clerkId: clerkUserId }, { email }] });
    if (!user) throw error;
    return { user };
  }
}

module.exports = async function auth(req, res, next) {
  try {
    const userId = getAuth(req)?.userId;
    if (!userId) return res.status(401).json({ message: 'Authentication required' });

    let user = await User.findOne({ clerkId: userId });
    if (!user) {
      let outcome;
      try {
        outcome = await provisionUser(userId);
      } catch (syncError) {
        console.error('[Auth] Could not provision user:', syncError.message);
        return res.status(401).json({ message: 'Failed to verify your account' });
      }
      if (outcome.error) return res.status(outcome.error.status).json({ message: outcome.error.message, code: outcome.error.code });
      user = outcome.user;
    }

    if (user.status === 'suspended') return res.status(403).json({ message: 'This account has been suspended' });
    req.user = user;
    req.userId = user._id.toString();
    req.userRole = user.role || 'user';
    req.clerkUserId = userId;
    return next();
  } catch (error) {
    console.error('[Auth] Unexpected error:', error.message);
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

module.exports.requireAdmin = function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};

module.exports.provisionUser = provisionUser;
