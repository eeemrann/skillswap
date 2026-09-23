const axios = require('axios');
const User = require('../models/User');

const normalizeSkills = (skills = []) => new Set(
  skills.filter(Boolean).map((skill) => String(skill).trim().toLowerCase())
);

const hasAvailabilityOverlap = (first = [], second = []) => {
  return first.some((a) => second.some((b) => a.day === b.day && a.start < b.end && b.start < a.end));
};

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

const locationMatch = (first = {}, second = {}) => {
  if (validCoordinates(first.coordinates) && validCoordinates(second.coordinates)) {
    return { matched: haversineDistanceKm(first.coordinates, second.coordinates) <= 25, source: 'coordinates' };
  }
  const firstCity = String(first?.city || '').trim().toLowerCase();
  const secondCity = String(second?.city || '').trim().toLowerCase();
  return { matched: Boolean(firstCity && secondCity && firstCity === secondCity), source: 'city' };
};

const matchLocally = (me, candidates) => {
  const wanted = normalizeSkills(me.skillsWanted);

  return candidates.map((candidate) => {
    const overlap = [...normalizeSkills(candidate.skillsOffered)].filter((skill) => wanted.has(skill));
    if (!overlap.length) return null;

    const availabilityOverlap = hasAvailabilityOverlap(me.availability, candidate.availability);
    const locationResult = locationMatch(me.location, candidate.location);
    const locationOverlap = locationResult.matched;
    return {
      id: candidate.id,
      name: candidate.name,
      matchedSkills: overlap,
      score: overlap.length + (availabilityOverlap ? 0.25 : 0) + (locationOverlap ? 0.25 : 0),
      matchReasons: [
        ...overlap.map((skill) => `Offers ${skill}`),
        ...(availabilityOverlap ? ['Availability overlaps'] : []),
        ...(locationOverlap ? [locationResult.source === 'coordinates' ? 'Within 25km' : 'Same location'] : [])
      ]
    };
  }).filter(Boolean).sort((first, second) => second.score - first.score);
};

exports.getMatches = async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    if (!me) return res.status(404).json({ message: 'User not found' });
    const others = await User.find({ _id: { $ne: req.userId }, status: { $ne: 'suspended' } })
      .select('name skillsOffered location availability');

    const candidates = others.map(u => ({
      id: u._id.toString(),
      name: u.name,
      skillsOffered: u.skillsOffered,
      location: u.location,
      availability: u.availability
    }));

    const matchingServiceUrl = process.env.MATCHING_SERVICE_URL || 'http://localhost:6000';

    const matchingServiceTimeoutMs = Number(process.env.MATCHING_SERVICE_TIMEOUT_MS || 60000);

    if (!me.skillsWanted?.length || !candidates.length) return res.json([]);

    try {
      const response = await axios.post(`${matchingServiceUrl}/match`, {
        mySkillsWanted: me.skillsWanted,
        myLocation: me.location,
        myAvailability: me.availability,
        candidates
      }, { timeout: matchingServiceTimeoutMs });

      return res.json(response.data);
    } catch {
      // Keep recommendations useful when the optional Python service is asleep
      // or not deployed alongside the API.
      return res.json(matchLocally(me, candidates));
    }
  } catch (err) {
    console.error('Recommendations failed:', err.message);
    res.status(500).json({ message: 'Could not load recommendations' });
  }
};
