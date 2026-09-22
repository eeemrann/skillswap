const { getAuth, clerkClient } = require('@clerk/express');
const User = require('../models/User');

module.exports = async function auth(req, res, next) {
  try {
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // TEMP AUTH DEBUG: remove after diagnosing intermittent 401 responses.
      console.warn('[Auth Middleware] Missing or malformed Authorization header', {
        method: req.method,
        path: req.originalUrl,
        authorizationPresent: Boolean(authHeader),
        authorizationPrefix: authHeader ? `${authHeader.slice(0, 20)}...` : null
      });
    }

    const authData = getAuth(req);
    req.auth = authData;
    const userId = authData?.userId;
    if (!userId) {
      // TEMP AUTH DEBUG: remove after diagnosing intermittent 401 responses.
      console.warn('[Auth Middleware] getAuth(req) did not find a valid userId. Check CLERK_SECRET_KEY and Clerk configuration.');
      console.warn('[Auth Middleware] Auth diagnostic', JSON.stringify({
        authorizationPresent: Boolean(authHeader),
        authorizationPrefix: authHeader ? `${authHeader.slice(0, 20)}...` : null,
        authData: authData ? {
          userId: authData.userId || null,
          sessionId: authData.sessionId || null,
          isAuthenticated: authData.isAuthenticated,
          reason: authData.reason,
          error: typeof authData.error === 'string' ? authData.error : authData.error?.message || null
        } : null
      }));
      return res.status(401).json({ message: 'Authentication required' });
    }

    let user = await User.findOne({ clerkId: userId });
    if (!user) {
      try {
        const clerkUser = await clerkClient.users.getUser(userId);
        const primaryEmail = clerkUser.emailAddresses?.find((item) => item.id === clerkUser.primaryEmailAddressId)?.emailAddress
          || clerkUser.emailAddresses?.[0]?.emailAddress;
        if (!primaryEmail) return res.status(401).json({ message: 'Your Clerk account has no email address' });

        const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ')
          || clerkUser.username || 'SkillSwap member';
        const email = primaryEmail.toLowerCase();
        try {
          user = await User.findOneAndUpdate(
            { email },
            {
              $set: { clerkId: userId, authProvider: 'clerk' },
              $setOnInsert: {
                name,
                email,
                profilePicture: clerkUser.imageUrl || '',
                creditBalance: 5,
                skillsOffered: [],
                skillsWanted: [],
                status: 'active'
              }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        } catch (syncError) {
          if (syncError.code !== 11000) throw syncError;
          user = await User.findOne({ $or: [{ clerkId: userId }, { email }] });
          if (!user) throw syncError;
        }
      } catch (syncError) {
        console.error('[Auth Middleware] Error fetching or provisioning Clerk user:', syncError.message);
        return res.status(401).json({ message: 'Failed to verify Clerk user record' });
      }
    }

    if (user.status === 'suspended') return res.status(403).json({ message: 'This account has been suspended' });
    req.user = user;
    req.userId = user._id.toString();
    req.userRole = user.role || 'user';
    req.clerkUserId = userId;
    return next();
  } catch (error) {
    console.error('[Auth Middleware] Unexpected error:', error.message);
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

module.exports.requireAdmin = function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
};
