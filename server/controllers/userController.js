const mongoose = require('mongoose');
const User = require('../models/User');

const cleanSkills = (value) => {
  if (!Array.isArray(value)) return [];
  const unique = new Map();
  value.forEach((skill) => {
    const cleaned = typeof skill === 'string' ? skill.trim() : '';
    if (cleaned && cleaned.length <= 80) unique.set(cleaned.toLowerCase(), cleaned);
  });
  return [...unique.values()].slice(0, 25);
};

// GET the logged-in user's own profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password'); // never send password back
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Profile could not be loaded' });
  }
};

// UPDATE the logged-in user's skills
exports.updateSkills = async (req, res) => {
  try {
    const skillsOffered = cleanSkills(req.body.skillsOffered);
    const skillsWanted = cleanSkills(req.body.skillsWanted);

    const user = await User.findByIdAndUpdate(
      req.userId,
      { skillsOffered, skillsWanted },
      { new: true, runValidators: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Skills could not be updated' });
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
    res.status(400).json({ message: 'Profile update failed' });
  }
};

// GET all other users (for browsing skills) — excludes the logged-in user and passwords
exports.getAllUsers = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
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
      },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ]);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Users could not be loaded' });
  }
};

exports.updateCompleteProfile = async (req, res) => {
  try {
    const { bio, timezone, location, availability } = req.body;
    const cleanAvailability = Array.isArray(availability) ? availability.filter((slot) => slot?.day && slot?.start && slot?.end).slice(0, 30) : [];
    if (cleanAvailability.some((slot) => slot.start >= slot.end)) return res.status(400).json({ message: 'Availability end time must be after start time' });
    const user = await User.findByIdAndUpdate(req.userId, {
      skillsOffered: cleanSkills(req.body.skillsOffered), skillsWanted: cleanSkills(req.body.skillsWanted),
      bio: typeof bio === 'string' ? bio.trim() : '',
      timezone: typeof timezone === 'string' && timezone.length <= 100 ? timezone.trim() : 'UTC',
      location: { city: typeof location?.city === 'string' ? location.city.trim().slice(0, 100) : '', country: typeof location?.country === 'string' ? location.country.trim().slice(0, 100) : '' },
      availability: cleanAvailability
    }, { new: true, runValidators: true }).select('-password');
    return res.json(user);
  } catch (error) {
    return res.status(400).json({ message: 'Profile update failed' });
  }
};
