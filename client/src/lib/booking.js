import { idOf } from './format';

export const STATUS_META = {
  pending: { label: 'Awaiting confirmation', tone: 'warning' },
  accepted: { label: 'Confirmed', tone: 'brand' },
  completed: { label: 'Completed', tone: 'success' },
  declined: { label: 'Declined', tone: '' },
  cancelled: { label: 'Cancelled', tone: '' },
  expired: { label: 'Expired', tone: '' }
};

/** The member on the other side of a booking, and which side the viewer is on. */
export function perspective(booking, userId) {
  const iAmLearner = idOf(booking.requester) === userId;
  return {
    role: iAmLearner ? 'learner' : 'teacher',
    other: iAmLearner ? booking.provider : booking.requester
  };
}

/** Where a confirmed session stands relative to `now` (ms). */
export function joinState(booking, now) {
  const opens = new Date(booking.joinOpensAt).getTime();
  const closes = new Date(booking.joinClosesAt).getTime();
  const starts = new Date(booking.proposedTime).getTime();
  if (now < opens) return { phase: 'upcoming', startsInMs: starts - now, opensInMs: opens - now };
  if (now <= closes) return { phase: 'open', live: now >= starts, startsInMs: starts - now };
  return { phase: 'over' };
}

/** "in 2h 5m" / "in 3 days" style countdown. */
export function countdown(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}
