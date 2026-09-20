const mongoose = require('mongoose');
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
    const users = await User.aggregate([
      { $match: { _id: { $ne: new mongoose.Types.ObjectId(req.userId) }, status: { $ne: 'suspended' } } },
      {
        $lookup: {
          from: 'reviews',           // Mongoose auto-pluralizes the 'Review' model to this collection name
          localField: '_id',
          foreignField: 'reviewee',
          as: 'reviews'
        }
      },
      {
        $addFields: {
          averageRating: {
            $cond: [{ $gt: [{ $size: '$reviews' }, 0] }, { $round: [{ $avg: '$reviews.rating' }, 1] }, 0]
          },
          reviewCount: { $size: '$reviews' }
        }
      },
      {
        $project: {
          name: 1, bio: 1, skillsOffered: 1, skillsWanted: 1,
          location: 1, timezone: 1, availability: 1,
          averageRating: 1, reviewCount: 1
        }
      }
    ]);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};