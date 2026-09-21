const Transaction = require('../models/Transaction');

exports.getHistory = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      $or: [{ from: req.userId }, { to: req.userId }]
    })
      .populate('from', 'name')
      .populate('to', 'name')
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(Number(req.query.limit) || 50, 1), 100));

    res.json(transactions);
  } catch (err) {
    console.error('Credit history failed:', err.message);
    res.status(500).json({ message: 'Credit history could not be loaded' });
  }
};
