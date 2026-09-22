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

const validCoordinates = (coordinates) => Array.isArray(coordinates)
  && coordinates.length === 2
  && coordinates.every((value) => typeof value === 'number' && Number.isFinite(value))
  && coordinates[0] >= -180 && coordinates[0] <= 180
  && coordinates[1] >= -90 && coordinates[1] <= 90
  && !(coordinates[0] === 0 && coordinates[1] === 0);

const findUserByAnyId = async (id) => {
  if (!id) return null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    const user = await User.findById(id);
    if (user) return user;
  }
  return User.findOne({ clerkId: id });
};

// GET the logged-in user's own profile
exports.getProfile = async (req, res) => {
  try {
    if (req.user) {
      const user = req.user.toObject ? req.user.toObject() : { ...req.user };
      delete user.password;
      return res.json(user);
    }

    const user = await findUserByAnyId(req.userId || req.clerkUserId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const profile = user.toObject ? user.toObject() : user;
    delete profile.password;
    return res.json(profile);
  } catch (err) {
    console.error('[getMe] Error fetching user profile:', err);
    return res.status(500).json({ message: 'Server error retrieving profile' });
  }
};

exports.getMe = exports.getProfile;

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
    const user = req.user || await findUserByAnyId(req.userId || req.clerkUserId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { bio, timezone, location, availability } = req.body;
    if (bio !== undefined) user.bio = typeof bio === 'string' ? bio.trim() : '';
    if (timezone !== undefined) user.timezone = typeof timezone === 'string' ? timezone.trim() : 'UTC';
    if (Array.isArray(availability)) user.availability = availability.filter((slot) => slot && slot.day && slot.start && slot.end);

    if (location && typeof location === 'object') {
      const coordinates = location.coordinates;
      if (coordinates !== undefined && validCoordinates(coordinates)) {
        user.location = user.location || {};
        user.location.type = 'Point';
        user.location.coordinates = [...coordinates];
      } else if (coordinates !== undefined && coordinates !== null) {
        return res.status(400).json({ message: 'Location coordinates must be [longitude, latitude]' });
      }
      user.location = user.location || {};
      if (location.city !== undefined) user.location.city = String(location.city).trim();
      if (location.country !== undefined) user.location.country = String(location.country).trim();
      if (!validCoordinates(user.location.coordinates)) {
        user.location.type = undefined;
        user.location.coordinates = undefined;
      }
    }

    const updatedUser = await user.save();
    const profile = updatedUser.toObject();
    delete profile.password;
    return res.json(profile);
  } catch (err) {
    res.status(400).json({ message: 'Profile update failed' });
  }
};

// GET all other users (for browsing skills) — excludes the logged-in user and passwords
exports.getAllUsers = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const requesterFilter = mongoose.Types.ObjectId.isValid(req.userId)
    ? { _id: { $ne: new mongoose.Types.ObjectId(req.userId) } }
    : {};
  const fallback = () => User.find({ ...requesterFilter, status: { $ne: 'suspended' } })
    .select('-password').skip((page - 1) * limit).limit(limit).lean();
  try {
    const lng = Number(req.query.lng);
    const lat = Number(req.query.lat);
    const hasValidQueryCoordinates = req.query.lng !== undefined && req.query.lat !== undefined
      && Number.isFinite(lng) && Number.isFinite(lat)
      && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
    if (!hasValidQueryCoordinates) return res.status(200).json(await fallback());
    console.log('Querying near:', [lng, lat], 'Requester ID:', req.userId);
    const maxDistanceMeters = 25000;
    const users = await User.aggregate([
      { $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'distanceMeters', maxDistance: maxDistanceMeters,
        query: { ...requesterFilter, status: { $ne: 'suspended' }, 'location.type': 'Point', 'location.coordinates': { $exists: true, $ne: [] } },
        spherical: true
      } },
      { $addFields: { distanceKm: { $round: [{ $divide: ['$distanceMeters', 1000] }, 1] } } },
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
    console.log('Found nearby users count:', users.length);
    if (users.length === 0) {
      console.log('GeoNear returned 0. Falling back to all active users.');
      return res.status(200).json(await fallback());
    }
    return res.status(200).json(users);
  } catch (err) {
    console.warn('Nearby user lookup unavailable; falling back to all active users:', err.message);
    try {
      return res.status(200).json(await fallback());
    } catch (fallbackError) {
      console.error('User fallback lookup failed:', fallbackError.message);
      return res.status(200).json([]);
    }
  }
};

exports.updateCoordinates = async (req, res) => {
  const { longitude, latitude } = req.body;
  if (typeof longitude !== 'number' || typeof latitude !== 'number'
    || !Number.isFinite(longitude) || !Number.isFinite(latitude)
    || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    return res.status(400).json({ message: 'Valid longitude and latitude are required' });
  }

  try {
    const user = await User.findByIdAndUpdate(req.userId, {
      $set: {
        'location.type': 'Point',
        'location.coordinates': [longitude, latitude],
        'location.lastUpdated': new Date()
      }
    }, { new: true, runValidators: true }).select('location');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ location: user.location });
  } catch (err) {
    return res.status(400).json({ message: 'Location could not be updated' });
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
      availability: cleanAvailability
    }, { new: true, runValidators: true }).select('-password');
    if (location && typeof location === 'object') {
      user.location = user.location || {};
      if (location.city !== undefined) user.location.city = String(location.city).trim().slice(0, 100);
      if (location.country !== undefined) user.location.country = String(location.country).trim().slice(0, 100);
      if (location.coordinates !== undefined) {
        if (!validCoordinates(location.coordinates)) return res.status(400).json({ message: 'Location coordinates must be [longitude, latitude]' });
        user.location.type = 'Point';
        user.location.coordinates = [...location.coordinates];
      }
      await user.save();
    }
    return res.json(user);
  } catch (error) {
    return res.status(400).json({ message: 'Profile update failed' });
  }
};
