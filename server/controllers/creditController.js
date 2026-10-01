const { Transaction } = require('../models');
const { round2 } = require('../utils/money');

exports.getHistory = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const query = { $or: [{ from: req.userId }, { to: req.userId }] };
  const [transactions, total] = await Promise.all([
    Transaction.find(query).populate('from', 'name').populate('to', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Transaction.countDocuments(query)
  ]);
  const me = String(req.userId);
  // Express each entry from the caller's point of view: positive when credits arrived.
  const entries = transactions.map((item) => {
    const received = String(item.to?._id || item.to) === me;
    return {
      _id: item._id,
      type: item.type || 'session',
      direction: received ? 'in' : 'out',
      amount: received ? round2(item.amount - (item.fee || 0)) : item.amount,
      fee: received ? item.fee || 0 : 0,
      counterpart: received ? item.from?.name || null : item.to?.name || null,
      description: item.description || '',
      createdAt: item.createdAt
    };
  });
  res.set('X-Total-Count', String(total)).json(entries);
};
