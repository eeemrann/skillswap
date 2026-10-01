const mongoose = require('mongoose');
const crypto = require('crypto');
const { clerkClient } = require('@clerk/express');
const { User, Booking, Transaction, Message, Notification, Review } = require('../models');
const { planFor } = require('../config/plans');
const { HttpError } = require('../utils/transaction');
const { getStripe } = require('../services/stripeService');

const ALLOWED_RADIUS_KM = [25, 50, 100, 200, 400];
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const PRO_STATUSES = ['active', 'trialing', 'past_due'];

const parseRadiusKm = (value) => {
  if (String(value || '').trim().toLowerCase() === 'worldwide') return 'worldwide';
  const radiusKm = Number(value);
  return ALLOWED_RADIUS_KM.includes(radiusKm) ? radiusKm : 'worldwide';
};

const cleanList = (value, { max, length = 80 }) => {
  if (!Array.isArray(value)) return [];
  const unique = new Map();
  value.forEach((item) => {
    const cleaned = typeof item === 'string' ? item.trim() : '';
    if (cleaned && cleaned.length <= length) unique.set(cleaned.toLowerCase(), cleaned);
  });
  return [...unique.values()].slice(0, max);
};
const cleanSkills = (value) => cleanList(value, { max: 25 });
const cleanLanguages = (value) => cleanList(value, { max: 8, length: 40 });

const validCoordinates = (coordinates) => Array.isArray(coordinates)
  && coordinates.length === 2
  && coordinates.every((value) => typeof value === 'number' && Number.isFinite(value))
  && coordinates[0] >= -180 && coordinates[0] <= 180
  && coordinates[1] >= -90 && coordinates[1] <= 90
  && !(coordinates[0] === 0 && coordinates[1] === 0);

const validTimezone = (value) => {
  if (typeof value !== 'string' || !value || value.length > 100) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; } catch { return false; }
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findUserByAnyId = async (id) => {
  if (!id) return null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    const user = await User.findById(id);
    if (user) return user;
  }
  return User.findOne({ clerkId: id });
};

/** What the signed-in member sees about their own account. */
const privateProfile = (user) => {
  const profile = user.toObject ? user.toObject() : { ...user };
  const plan = planFor(user);
  const hasBilling = Boolean(profile.stripeCustomerId);
  delete profile.stripeCustomerId;
  delete profile.stripeSubscriptionId;
  return {
    ...profile,
    hasBilling,
    effectivePlan: plan.id,
    availableCredits: Math.round(((profile.creditBalance || 0) - (profile.creditsHeld || 0)) * 100) / 100,
    limits: { maxActiveBookings: plan.maxActiveBookings, maxSessionMinutes: plan.maxSessionMinutes, serviceFeePct: plan.serviceFeePct }
  };
};

/** Community-facing view: no email, balances, billing, or exact coordinates. */
const publicProfile = (user) => {
  const profile = user.toObject ? user.toObject() : { ...user };
  return {
    _id: profile._id,
    name: profile.name,
    profilePicture: profile.profilePicture,
    bio: profile.bio,
    skillsOffered: profile.skillsOffered,
    skillsWanted: profile.skillsWanted,
    languages: profile.languages || [],
    timezone: profile.timezone,
    availability: profile.availability || [],
    location: { city: profile.location?.city || '', country: profile.location?.country || '' },
    isPro: planFor(profile).id === 'pro',
    createdAt: profile.createdAt
  };
};

exports.getProfile = async (req, res) => res.json(privateProfile(req.user));
exports.getMe = exports.getProfile;

exports.getPublicProfile = async (req, res) => {
  const user = await findUserByAnyId(req.params.id);
  if (!user || user.status === 'suspended') throw new HttpError(404, 'Member not found');
  const [sessionsTaught, sessionsLearned] = await Promise.all([
    Booking.countDocuments({ provider: user._id, status: 'completed' }),
    Booking.countDocuments({ requester: user._id, status: 'completed' })
  ]);
  res.json({ ...publicProfile(user), sessionsTaught, sessionsLearned });
};

exports.updateCompleteProfile = async (req, res) => {
  const { bio, timezone, location, availability } = req.body;
  const slots = Array.isArray(availability) ? availability.filter((slot) => slot?.day && slot?.start && slot?.end).slice(0, 35) : [];
  if (slots.some((slot) => !DAYS.includes(slot.day) || !TIME_PATTERN.test(slot.start) || !TIME_PATTERN.test(slot.end))) {
    throw new HttpError(400, 'Availability must use a weekday and HH:MM times');
  }
  if (slots.some((slot) => slot.start >= slot.end)) throw new HttpError(400, 'Availability end time must be after start time');

  const user = req.user;
  if (req.body.skillsOffered !== undefined) user.skillsOffered = cleanSkills(req.body.skillsOffered);
  if (req.body.skillsWanted !== undefined) user.skillsWanted = cleanSkills(req.body.skillsWanted);
  if (req.body.languages !== undefined) user.languages = cleanLanguages(req.body.languages);
  if (typeof bio === 'string') user.bio = bio.trim().slice(0, 500);
  if (timezone !== undefined) user.timezone = validTimezone(timezone) ? timezone : 'UTC';
  if (Array.isArray(availability)) user.availability = slots;

  // Patch the loaded location so existing coordinates survive a city/country-only edit,
  // and never persist a Point without coordinates.
  if (location && typeof location === 'object') {
    user.location = user.location || {};
    if (location.city !== undefined) user.location.city = String(location.city).trim().slice(0, 100);
    if (location.country !== undefined) user.location.country = String(location.country).trim().slice(0, 100);
    if (location.coordinates !== undefined) {
      if (!validCoordinates(location.coordinates)) throw new HttpError(400, 'Location coordinates must be [longitude, latitude]');
      user.location.type = 'Point';
      user.location.coordinates = [...location.coordinates];
    }
    if (!validCoordinates(user.location.coordinates)) {
      user.location.type = undefined;
      user.location.coordinates = undefined;
    }
  }
  await user.save();
  res.json(privateProfile(user));
};

/** Explicit, member-initiated location update. */
exports.updateCoordinates = async (req, res) => {
  const { longitude, latitude } = req.body;
  if (!validCoordinates([longitude, latitude])) throw new HttpError(400, 'Valid longitude and latitude are required');
  const user = await User.findByIdAndUpdate(req.userId, {
    $set: { 'location.type': 'Point', 'location.coordinates': [longitude, latitude], 'location.lastUpdated': new Date() }
  }, { new: true, runValidators: true }).select('location');
  if (!user) throw new HttpError(404, 'Member not found');
  res.json({ location: { city: user.location?.city || '', country: user.location?.country || '', hasCoordinates: true } });
};

exports.clearLocation = async (req, res) => {
  await User.updateOne({ _id: req.userId }, { $unset: { location: 1 } });
  res.json({ location: null });
};

/**
 * Member directory. Optional `q` searches names and skills; with coordinates
 * and a radius it returns nearby members ordered by Pro placement, then distance.
 */
exports.getAllUsers = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 60);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const radiusKm = parseRadiusKm(req.query.radiusKm);
  const q = String(req.query.q || '').trim().slice(0, 80);
  const lng = Number(req.query.lng);
  const lat = Number(req.query.lat);
  const hasCoordinates = req.query.lng !== undefined && req.query.lat !== undefined && validCoordinates([lng, lat]);
  const useGeo = hasCoordinates && radiusKm !== 'worldwide';

  const match = {
    _id: { $ne: new mongoose.Types.ObjectId(req.userId) },
    status: { $ne: 'suspended' },
    'skillsOffered.0': { $exists: true }
  };
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    match.$or = [{ name: pattern }, { skillsOffered: pattern }, { skillsWanted: pattern }];
  }

  const isPro = { $cond: [{ $and: [{ $eq: ['$plan', 'pro'] }, { $in: [{ $ifNull: ['$planStatus', 'active'] }, PRO_STATUSES] }] }, true, false] };
  const pipeline = [];
  if (useGeo) {
    pipeline.push({ $geoNear: {
      near: { type: 'Point', coordinates: [lng, lat] },
      distanceField: 'distanceMeters',
      maxDistance: radiusKm * 1000,
      query: { ...match, 'location.type': 'Point' },
      spherical: true
    } });
  } else {
    pipeline.push({ $match: match });
  }
  pipeline.push(
    { $addFields: { isPro: isPro } },
    { $facet: {
      items: [
        { $sort: useGeo ? { isPro: -1, distanceMeters: 1, _id: 1 } : { isPro: -1, createdAt: -1, _id: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $lookup: {
          from: 'reviews',
          let: { id: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$reviewee', '$$id'] } } },
            { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }
          ],
          as: 'ratingSummary'
        } },
        { $project: {
          name: 1, bio: 1, profilePicture: 1, skillsOffered: 1, skillsWanted: 1, languages: 1, timezone: 1, isPro: 1, createdAt: 1,
          'location.city': 1, 'location.country': 1,
          distanceKm: useGeo ? { $round: [{ $divide: ['$distanceMeters', 1000] }, 1] } : '$$REMOVE',
          averageRating: { $round: [{ $ifNull: [{ $first: '$ratingSummary.average' }, 0] }, 1] },
          reviewCount: { $ifNull: [{ $first: '$ratingSummary.count' }, 0] }
        } }
      ],
      total: [{ $count: 'count' }]
    } }
  );

  const [result] = await User.aggregate(pipeline);
  res.set('X-Total-Count', String(result?.total?.[0]?.count || 0)).json(result?.items || []);
};

/** GDPR-style export of everything the platform holds about the signed-in member. */
exports.exportData = async (req, res) => {
  const id = req.user._id;
  const [bookings, transactions, messages, reviews] = await Promise.all([
    Booking.find({ $or: [{ requester: id }, { provider: id }] }).select('-roomId').lean(),
    Transaction.find({ $or: [{ from: id }, { to: id }] }).lean(),
    Message.find({ $or: [{ sender: id }, { recipient: id }] }).lean(),
    Review.find({ $or: [{ reviewer: id }, { reviewee: id }] }).lean()
  ]);
  res.set('Content-Disposition', 'attachment; filename="skillswap-data.json"').json({
    exportedAt: new Date().toISOString(), profile: privateProfile(req.user), bookings, transactions, messages, reviews
  });
};

/**
 * Deletes the member's account. Personal data is erased and the record becomes
 * an anonymous tombstone so other members' history stays consistent.
 */
exports.deleteAccount = async (req, res) => {
  const user = req.user;
  const obligations = await Booking.countDocuments({ status: 'accepted', $or: [{ requester: user._id }, { provider: user._id }] });
  if (obligations > 0) throw new HttpError(409, 'Cancel or complete your upcoming sessions before deleting your account');

  const stripe = getStripe();
  if (stripe && user.stripeSubscriptionId) {
    await stripe.subscriptions.cancel(user.stripeSubscriptionId).catch((error) => console.warn('Subscription cancel on delete failed:', error.message));
  }
  await Booking.updateMany({ status: 'pending', $or: [{ requester: user._id }, { provider: user._id }] }, { status: 'cancelled', cancelledBy: user._id, cancelReason: 'Account deleted' });
  await Promise.all([Message.deleteMany({ $or: [{ sender: user._id }, { recipient: user._id }] }), Notification.deleteMany({ userId: user._id })]);

  const clerkId = user.clerkId;
  await User.collection.updateOne({ _id: user._id }, {
    $set: {
      name: 'Deleted member', email: `deleted-${user._id}-${crypto.randomBytes(4).toString('hex')}@deleted.invalid`, profilePicture: '', bio: '',
      skillsOffered: [], skillsWanted: [], languages: [], availability: [], status: 'suspended', plan: 'free', planStatus: 'canceled', creditsHeld: 0
    },
    $unset: { clerkId: '', location: '', stripeSubscriptionId: '', stripeCustomerId: '' }
  });
  if (clerkId) await clerkClient.users.deleteUser(clerkId).catch((error) => console.warn('Clerk user deletion failed:', error.message));
  res.json({ message: 'Your account has been deleted' });
};

exports.privateProfile = privateProfile;
exports.publicProfile = publicProfile;
exports.validCoordinates = validCoordinates;
