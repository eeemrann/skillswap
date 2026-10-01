const { User, Booking } = require('../../models');

let counter = 0;

const makeUser = (overrides = {}) => {
  counter += 1;
  return User.create({
    name: `Member ${counter}`,
    email: `member${counter}-${Date.now()}@example.com`,
    clerkId: `clerk_${counter}_${Date.now()}`,
    skillsOffered: ['Guitar'],
    skillsWanted: ['Spanish'],
    creditBalance: 5,
    ...overrides
  });
};

const hoursFromNow = (hours) => new Date(Date.now() + hours * 3600 * 1000);

const makeBooking = (requester, provider, overrides = {}) => Booking.create({
  requester: requester._id,
  provider: provider._id,
  skill: 'Guitar',
  proposedTime: hoursFromNow(24),
  durationMinutes: 60,
  credits: 1,
  ...overrides
});

module.exports = { makeUser, makeBooking, hoursFromNow };
