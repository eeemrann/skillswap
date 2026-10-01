const { Booking, User } = require('../models');
const { appUrl, autoSettleHours } = require('../config');
const { bothAttended } = require('./sessionService');
const { settleBooking, closeBooking } = require('./bookingService');
const { queueEmail, createInAppNotification } = require('./notificationService');

const REMINDER_LEAD_MS = 30 * 60 * 1000;

/** Sends a reminder to both members shortly before a confirmed session. Each booking is claimed atomically. */
async function sendReminders(now = new Date()) {
  const due = await Booking.find({
    status: 'accepted',
    reminderSentAt: { $exists: false },
    proposedTime: { $gt: new Date(now.getTime() - 10 * 60 * 1000), $lte: new Date(now.getTime() + REMINDER_LEAD_MS) }
  }).limit(50);

  for (const booking of due) {
    const claimed = await Booking.updateOne({ _id: booking._id, reminderSentAt: { $exists: false } }, { $set: { reminderSentAt: now } });
    if (claimed.modifiedCount !== 1) continue;
    const people = await User.find({ _id: { $in: [booking.requester, booking.provider] } }).select('name email timezone');
    for (const person of people) {
      const other = people.find((candidate) => String(candidate._id) !== String(person._id));
      await Promise.all([
        createInAppNotification({ userId: person._id, type: 'session', message: `Your ${booking.skill} session starts soon`, relatedId: booking._id }),
        queueEmail('SESSION_REMINDER', person.email, {
          actor: other?.name || 'your partner', skill: booking.skill, time: booking.proposedTime.toISOString(),
          timezone: person.timezone, url: `${appUrl()}/session/${booking._id}`
        })
      ]);
    }
  }
}

/**
 * Closes out bookings nobody finished:
 *  - sessions both members attended settle automatically once the learner's confirmation window passes;
 *  - sessions that did not happen are released without a charge;
 *  - requests whose start time passed unanswered expire.
 */
async function settleOverdue(now = new Date()) {
  const settleAfterMs = autoSettleHours() * 3600 * 1000;
  const overdue = await Booking.find({
    status: 'accepted',
    $expr: { $lt: [{ $add: ['$proposedTime', { $multiply: [{ $ifNull: ['$durationMinutes', 60] }, 60000] }, settleAfterMs] }, now] }
  }).limit(50);
  for (const booking of overdue) {
    try {
      if (bothAttended(booking)) await settleBooking(booking._id, { auto: true });
      else await closeBooking(booking._id, { status: 'expired', reason: 'Session did not take place' });
    } catch (error) {
      console.error('Overdue booking handling failed:', { bookingId: String(booking._id), detail: error.message });
      // Never leave credits stranded in escrow: if settlement is impossible, release instead.
      await closeBooking(booking._id, { status: 'expired', reason: 'Automatic settlement failed' }).catch(() => {});
    }
  }

  const stale = await Booking.find({ status: 'pending', proposedTime: { $lt: now } }).select('_id').limit(100);
  for (const booking of stale) {
    await closeBooking(booking._id, { status: 'expired', reason: 'Request was not answered in time' }).catch((error) => console.error('Expiring request failed:', error.message));
  }
}

function startSessionWorker() {
  const intervalMs = Number(process.env.SESSION_WORKER_INTERVAL_MS || 60000);
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await sendReminders();
      await settleOverdue();
    } catch (error) {
      console.error('Session worker failed:', error.message);
    } finally {
      running = false;
    }
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

module.exports = { sendReminders, settleOverdue, startSessionWorker };
