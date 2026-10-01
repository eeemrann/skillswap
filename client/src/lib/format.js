export const initials = (name = '') => name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SS';

/** Id of a populated or plain Mongo reference. */
export const idOf = (entity) => (typeof entity === 'string' ? entity : entity?._id || entity?.id);

/** 1 → "1", 1.5 → "1.5", 0.9 → "0.9"; never shows float noise. */
export const formatCredits = (value) => {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  return String(rounded);
};

export const creditsLabel = (value) => `${formatCredits(value)} ${Number(value) === 1 ? 'credit' : 'credits'}`;

export const formatMoney = (cents, currency = 'usd') => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: currency.toUpperCase(),
  minimumFractionDigits: cents % 100 === 0 ? 0 : 2
}).format((cents || 0) / 100);

export const formatDate = (value, options = { dateStyle: 'medium' }) => new Date(value).toLocaleDateString([], options);
export const formatDateTime = (value, options = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) => new Date(value).toLocaleString([], options);
export const formatTime = (value) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const formatDuration = (minutes) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

/** "3:07" or "1:02:09" from a number of seconds. */
export const formatClock = (seconds) => {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

/** "in 3 hours", "2 days ago". */
export const formatRelative = (value, now = Date.now()) => {
  const seconds = Math.round((new Date(value).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const steps = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(seconds, 'second');
};

export const locationLabel = (location) => [location?.city, location?.country].filter(Boolean).join(', ');

export const errorMessage = (error, fallback = 'Something went wrong. Please try again.') => error?.response?.data?.message || fallback;

export const SKILL_SUGGESTIONS = [
  'Spanish', 'French', 'English conversation', 'Japanese', 'Guitar', 'Piano', 'Singing', 'Photography', 'Video editing',
  'Figma', 'UX design', 'Illustration', 'React', 'JavaScript', 'Python', 'Data analysis', 'Excel', 'SQL', 'Public speaking',
  'Resume review', 'Product management', 'SEO', 'Copywriting', 'Cooking', 'Baking', 'Yoga', 'Chess', 'Personal finance'
];

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const capitalize = (value = '') => value.charAt(0).toUpperCase() + value.slice(1);

export const SESSION_DURATIONS = [30, 60, 90, 120, 180, 240];

/** Value for an <input type="datetime-local"> in the viewer's local time. */
export const toLocalInput = (ms) => {
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** Weekday name and HH:MM of an instant as seen in `timeZone`. */
export const zonedParts = (value, timeZone) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return { day: parts.weekday.toLowerCase(), time: `${parts.hour}:${parts.minute}` };
};

/** Does the whole [start, start+minutes) fit in one of the member's weekly slots (in their own timezone)? */
export const fitsAvailability = (startMs, minutes, timeZone, slots = []) => {
  if (!slots.length) return null;
  try {
    const start = zonedParts(startMs, timeZone);
    const end = zonedParts(startMs + minutes * 60000, timeZone);
    return slots.some((slot) => slot.day === start.day && slot.start <= start.time && (end.day !== start.day || end.time <= slot.end));
  } catch {
    return null;
  }
};
