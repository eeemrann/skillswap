const axios = require('axios');
const User = require('../models/User');

const normalizeSkills = (skills = []) => new Set(
  skills.filter(Boolean).map((skill) => String(skill).trim().toLowerCase())
);

const hasAvailabilityOverlap = (first = [], second = []) => {
  const slots = new Set(first.map((slot) => `${slot.day}|${slot.start}|${slot.end}`));
  return second.some((slot) => slots.has(`${slot.day}|${slot.start}|${slot.end}`));
};

const hasLocationOverlap = (first = {}, second = {}) => {
  const firstCity = String(first?.city || '').trim().toLowerCase();
  const secondCity = String(second?.city || '').trim().toLowerCase();
  return Boolean(firstCity && secondCity && firstCity === secondCity);
};

const matchLocally = (me, candidates) => {
  const wanted = normalizeSkills(me.skillsWanted);

  return candidates.map((candidate) => {
    const overlap = [...normalizeSkills(candidate.skillsOffered)].filter((skill) => wanted.has(skill));
    if (!overlap.length) return null;

    const availabilityOverlap = hasAvailabilityOverlap(me.availability, candidate.availability);
    const locationOverlap = hasLocationOverlap(me.location, candidate.location);
    return {
      id: candidate.id,
      name: candidate.name,
      matchedSkills: overlap,
      score: overlap.length + (availabilityOverlap ? 0.25 : 0) + (locationOverlap ? 0.25 : 0),
      matchReasons: [
        ...overlap.map((skill) => `Offers ${skill}`),
        ...(availabilityOverlap ? ['Availability overlaps'] : []),
        ...(locationOverlap ? ['Same location'] : [])
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

    if (!me.skillsWanted?.length || !me.skillsOffered?.length || !candidates.length) return res.json([]);

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
    res.status(500).json({ message: 'Could not load recommendations', error: err.message });
  }
};
