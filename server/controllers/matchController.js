const axios = require('axios');
const User = require('../models/User');
const { availabilityOverlaps } = require('../utils/availability');

const ALLOWED_RADIUS_KM = [25, 50, 100, 200, 400];

const parseRadiusKm = (value) => {
  if (String(value || '').trim().toLowerCase() === 'worldwide') return 'worldwide';
  const radiusKm = Number(value);
  return ALLOWED_RADIUS_KM.includes(radiusKm) ? radiusKm : 'worldwide';
};

const normalizeSkills = (skills = []) => new Set(
  skills.filter(Boolean).map((skill) => String(skill).trim().toLowerCase())
);

const validCoordinates = (coordinates) => (
  Array.isArray(coordinates) && coordinates.length === 2 &&
  coordinates.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
);

const haversineDistanceKm = (first, second) => {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const deltaLat = toRadians(second[1] - first[1]);
  const deltaLng = toRadians(second[0] - first[0]);
  const lat1 = toRadians(first[1]);
  const lat2 = toRadians(second[1]);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const locationMatch = (first = {}, second = {}, radiusKm = 'worldwide') => {
  if (validCoordinates(first.coordinates) && validCoordinates(second.coordinates)) {
    return {
      matched: radiusKm === 'worldwide' || haversineDistanceKm(first.coordinates, second.coordinates) <= radiusKm,
      source: 'coordinates'
    };
  }
  const firstCity = String(first?.city || '').trim().toLowerCase();
  const secondCity = String(second?.city || '').trim().toLowerCase();
  return { matched: Boolean(firstCity && secondCity && firstCity === secondCity), source: 'city' };
};

/**
 * Scores candidates against the member. Mirrors the Python matching service so
 * recommendations keep working if that service is unavailable.
 *
 *   score = wanted skills the candidate teaches
 *         + 0.5  if the candidate also wants something the member teaches (a true swap)
 *         + 0.25 if weekly availability overlaps (timezone-aware)
 *         + 0.25 if locations match
 */
const matchLocally = (me, candidates, radiusKm) => {
  const wanted = normalizeSkills(me.skillsWanted);
  const offered = normalizeSkills(me.skillsOffered);

  return candidates.map((candidate) => {
    const overlap = [...normalizeSkills(candidate.skillsOffered)].filter((skill) => wanted.has(skill));
    if (!overlap.length) return null;
    const mutual = [...normalizeSkills(candidate.skillsWanted)].filter((skill) => offered.has(skill));

    const availabilityOverlap = availabilityOverlaps(me.availability, me.timezone, candidate.availability, candidate.timezone);
    const locationResult = locationMatch(me.location, candidate.location, radiusKm);
    const locationOverlap = locationResult.matched;
    return {
      id: candidate.id,
      name: candidate.name,
      matchedSkills: overlap,
      mutualSkills: mutual,
      score: Math.round((overlap.length + (mutual.length ? 0.5 : 0) + (availabilityOverlap ? 0.25 : 0) + (locationOverlap ? 0.25 : 0)) * 100) / 100,
      matchReasons: [
        ...overlap.map((skill) => `Offers ${skill}`),
        ...(mutual.length ? ['Wants to learn from you too'] : []),
        ...(availabilityOverlap ? ['Availability overlaps'] : []),
        ...(locationOverlap ? [locationResult.source === 'coordinates'
          ? (radiusKm === 'worldwide' ? 'Worldwide' : `Within ${radiusKm}km`)
          : 'Same location'] : [])
      ]
    };
  }).filter(Boolean).sort((first, second) => second.score - first.score);
};

exports.getMatches = async (req, res) => {
  const radiusKm = parseRadiusKm(req.query?.radiusKm);
  const me = req.user;
  if (!me.skillsWanted?.length) return res.json([]);

  const others = await User.find({ _id: { $ne: me._id }, status: { $ne: 'suspended' }, teacherStatus: 'approved', skillsOffered: { $in: me.skillsWanted.map((skill) => new RegExp(`^${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) } })
    .select('name profilePicture skillsOffered skillsWanted location availability timezone plan planStatus teacherProfile')
    .limit(500)
    .lean();
  if (!others.length) return res.json([]);

  const candidates = others.map((user) => ({
    id: String(user._id),
    name: user.name,
    skillsOffered: user.skillsOffered,
    skillsWanted: user.skillsWanted,
    location: user.location,
    availability: user.availability,
    timezone: user.timezone
  }));
  const request = {
    mySkillsWanted: me.skillsWanted,
    mySkillsOffered: me.skillsOffered,
    myLocation: me.location,
    myAvailability: me.availability,
    myTimezone: me.timezone,
    radiusKm,
    candidates
  };

  let results;
  try {
    const response = await axios.post(`${process.env.MATCHING_SERVICE_URL || 'http://localhost:6000'}/match`, request, {
      timeout: Number(process.env.MATCHING_SERVICE_TIMEOUT_MS || 5000)
    });
    results = response.data;
  } catch {
    // The optional Python service is asleep or not deployed alongside the API.
    results = matchLocally(me, candidates, radiusKm);
  }

  const byId = new Map(others.map((user) => [String(user._id), user]));
  res.json(results.map((match) => {
    const user = byId.get(String(match.id));
    return {
      ...match,
      profilePicture: user?.profilePicture || '',
      city: user?.location?.city || '',
      skillsOffered: user?.skillsOffered || [],
      isPro: user?.plan === 'pro',
      headline: user?.teacherProfile?.headline || '',
      hourlyRateCredits: user?.teacherProfile?.hourlyRateCredits ?? 1,
      teacherType: user?.teacherProfile?.teacherType,
      tier: user?.teacherProfile?.tier || 'standard'
    };
  }));
};

module.exports.matchLocally = matchLocally;
