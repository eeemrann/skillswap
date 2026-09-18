const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function (req, res, next) {
  // Expect header: Authorization: Bearer <token>
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('role status');
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'This account has been suspended' });
    }

    req.userId = user._id.toString();
    req.userRole = user.role || decoded.role || 'user';
    next(); // token is valid, continue to the actual route
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports.requireAdmin = function (req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  next();
};