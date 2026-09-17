const User = require('../models/User');

// GET the logged-in user's own profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password'); // never send password back
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// UPDATE the logged-in user's skills
exports.updateSkills = async (req, res) => {
  try {
    const sanitize = (arr) =>
      Array.isArray(arr)
        ? arr.filter((s) => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
        : [];

    const skillsOffered = sanitize(req.body.skillsOffered);
    const skillsWanted = sanitize(req.body.skillsWanted);

    const user = await User.findByIdAndUpdate(
      req.userId,
      { skillsOffered, skillsWanted },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET all other users (for browsing skills) — excludes the logged-in user and passwords
exports.getAllUsers = async (req, res) => {
  try {
    // Only expose what the Browse page actually needs
    const users = await User.find({ _id: { $ne: req.userId } })
      .select('name skillsOffered skillsWanted');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};