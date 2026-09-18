const axios = require('axios');
const User = require('../models/User');

exports.getMatches = async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const others = await User.find({ _id: { $ne: req.userId }, status: { $ne: 'suspended' } })
      .select('name skillsOffered location availability');

    const candidates = others.map(u => ({
      id: u._id,
      name: u.name,
      skillsOffered: u.skillsOffered,
      location: u.location,
      availability: u.availability
    }));

    const matchingServiceUrl = process.env.MATCHING_SERVICE_URL || 'http://localhost:6000';

    const matchingServiceTimeoutMs = Number(process.env.MATCHING_SERVICE_TIMEOUT_MS || 60000);

    const response = await axios.post(`${matchingServiceUrl}/match`, {
      mySkillsWanted: me.skillsWanted,
      myLocation: me.location,
      myAvailability: me.availability,
      candidates
    }, { timeout: matchingServiceTimeoutMs });

    res.json(response.data);
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      return res.status(504).json({ message: 'Matching service timed out. Please try again shortly.' });
    }
    res.status(500).json({ message: 'Matching service error', error: err.message });
  }
};