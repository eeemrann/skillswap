const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const WEEK_MINUTES = 7 * 24 * 60;

/** UTC offset of an IANA timezone at `date`, in minutes. Unknown zones count as UTC. */
function tzOffsetMinutes(timeZone, date = new Date()) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(date).map((part) => [part.type, part.value]));
    const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  } catch {
    return 0;
  }
}

const toMinutes = (value) => {
  const [hours, minutes] = String(value).split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Converts a member's weekly slots (local weekday + HH:MM) into intervals of
 * minutes-since-Monday-00:00 UTC, splitting any interval that wraps the week.
 */
function toUtcIntervals(availability = [], timeZone = 'UTC', now = new Date()) {
  const offset = tzOffsetMinutes(timeZone || 'UTC', now);
  const intervals = [];
  (availability || []).forEach((slot) => {
    const day = DAYS.indexOf(slot?.day);
    if (day < 0 || !slot.start || !slot.end) return;
    const length = toMinutes(slot.end) - toMinutes(slot.start);
    if (!(length > 0)) return;
    const start = ((day * 1440 + toMinutes(slot.start) - offset) % WEEK_MINUTES + WEEK_MINUTES) % WEEK_MINUTES;
    const end = start + length;
    if (end <= WEEK_MINUTES) intervals.push([start, end]);
    else intervals.push([start, WEEK_MINUTES], [0, end - WEEK_MINUTES]);
  });
  return intervals;
}

/** True when two members share at least one overlapping slot, regardless of their timezones. */
function availabilityOverlaps(first, firstZone, second, secondZone, now = new Date()) {
  const a = toUtcIntervals(first, firstZone, now);
  const b = toUtcIntervals(second, secondZone, now);
  return a.some(([aStart, aEnd]) => b.some(([bStart, bEnd]) => aStart < bEnd && bStart < aEnd));
}

module.exports = { DAYS, tzOffsetMinutes, toUtcIntervals, availabilityOverlaps };
