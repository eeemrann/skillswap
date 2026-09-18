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

exports.updateProfile = async (req, res) => {
  try {
    const { bio, timezone, location, availability } = req.body;
    const cleanAvailability = Array.isArray(availability)
      ? availability.filter((slot) => slot && slot.day && slot.start && slot.end)
      : [];

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        bio: typeof bio === 'string' ? bio.trim() : '',
        timezone: typeof timezone === 'string' ? timezone.trim() : 'UTC',
        location: {
          city: typeof location?.city === 'string' ? location.city.trim() : '',
          country: typeof location?.country === 'string' ? location.country.trim() : '',
          coordinates: location?.coordinates
        },
        availability: cleanAvailability
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Profile update failed' });
  }
};

// GET all other users (for browsing skills) — excludes the logged-in user and passwords
exports.getAllUsers = async (req, res) => {
  try {
    // Only expose what the Browse page actually needs
    const users = await User.find({ _id: { $ne: req.userId }, status: { $ne: 'suspended' } })
      .select('name bio skillsOffered skillsWanted location timezone availability');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};