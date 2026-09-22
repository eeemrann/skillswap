const User = require('../models/User');
exports.logout = async (req, res) => {
  await User.findByIdAndUpdate(req.userId, { $inc: { tokenVersion: 1 } });
  return res.json({ message: 'Signed out successfully' });
};
