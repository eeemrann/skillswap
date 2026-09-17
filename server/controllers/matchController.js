const axios = require('axios');
const User = require('../models/User');

exports.getMatches = async (req, res) => {
  try {
    const me = await User.findById(req.userId);
    const others = await User.find({ _id: { $ne: req.userId } }).select('name skillsOffered');

    const candidates = others.map(u => ({
      id: u._id,
      name: u.name,
      skillsOffered: u.skillsOffered
    }));

    const matchingServiceUrl = process.env.MATCHING_SERVICE_URL || 'http://localhost:6000';

    const response = await axios.post(`${matchingServiceUrl}/match`, {
  mySkillsWanted: me.skillsWanted,
  candidates
}, { timeout: 5000 });

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ message: 'Matching service error', error: err.message });
  }
};