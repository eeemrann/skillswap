const Transaction = require('../models/Transaction');

exports.getHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      $or: [{ from: req.userId }, { to: req.userId }]
    })
      .populate('from', 'name')
      .populate('to', 'name')
      .sort({ createdAt: -1 });

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};