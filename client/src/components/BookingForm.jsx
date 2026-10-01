import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axios';
import { capitalize, creditsLabel, errorMessage, fitsAvailability, formatCredits, formatDateTime, formatDuration, SESSION_DURATIONS, toLocalInput } from '../lib/format';
import { useToast } from '../lib/toast';
import Icon from './Icon';

/** Request-a-session form: skill, time (with the teacher's local time), length, note and live cost. */
export default function BookingForm({ profile }) {
  const user = useSelector((state) => state.auth.user);
  const toast = useToast();
  const skills = profile.skillsOffered || [];
  const [minTime] = useState(() => toLocalInput(Date.now() + 30 * 60000));
  const [skill, setSkill] = useState(skills[0] || '');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const cost = duration / 60;
  const available = user?.availableCredits ?? user?.creditBalance ?? 0;
  const maxMinutes = user?.limits?.maxSessionMinutes ?? 60;
  const startMs = time ? new Date(time).getTime() : null;
  const valid = startMs && !Number.isNaN(startMs);
  const fits = valid ? fitsAvailability(startMs, duration, profile.timezone, profile.availability) : null;
  const short = available < cost;

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      await api.post('/bookings', { providerId: profile._id, skill, note, durationMinutes: duration, proposedTime: new Date(time).toISOString() }, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
      setSent(true);
      toast.success(`Request sent to ${profile.name.split(' ')[0]}`);
    } catch (err) {
      if (err.response?.status !== 402) setError(errorMessage(err, 'Your request could not be sent.'));
    } finally {
      setSending(false);
    }
  };

  if (!skills.length) return <section className="card card-pad"><p className="muted">{profile.name.split(' ')[0]} has not listed a skill to teach yet.</p></section>;

  if (sent) {
    return (
      <section className="card card-pad stack booking-sent" style={{ '--gap': '12px' }}>
        <span className="empty-icon"><Icon name="checkCircle" size={24} /></span>
        <h2 className="card-title">Request sent</h2>
        <p className="muted small">{profile.name.split(' ')[0]} will confirm the time. Your credits are reserved only once they accept, and you will be notified.</p>
        <div className="row"><Link className="btn btn-primary btn-sm" to="/bookings">View sessions</Link><button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSent(false); setTime(''); setNote(''); }}>Book another</button></div>
      </section>
    );
  }

  return (
    <form className="card card-pad stack booking-form" style={{ '--gap': '16px' }} onSubmit={submit}>
      <div className="row spread"><h2 className="card-title">Book a live session</h2><span className="badge brand"><Icon name="video" size={12} /> Video</span></div>

      <div className="field">
        <label htmlFor="bk-skill">Skill</label>
        <select id="bk-skill" className="select" value={skill} onChange={(event) => setSkill(event.target.value)}>{skills.map((item) => <option key={item}>{item}</option>)}</select>
      </div>

      <div className="field">
        <label htmlFor="bk-time">Date and time <span className="faint">(your time)</span></label>
        <input id="bk-time" className="input" type="datetime-local" required min={minTime} value={time} onChange={(event) => setTime(event.target.value)} />
        {valid && (
          <span className={`hint ${fits === false ? 'warn' : ''}`}>
            {formatDateTime(startMs, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: profile.timezone, timeZoneName: 'short' })} for {profile.name.split(' ')[0]}
            {fits === true && ' · within their availability'}
            {fits === false && ' · outside their usual availability, they may decline'}
          </span>
        )}
      </div>

      <div className="field">
        <label htmlFor="bk-duration">Length</label>
        <select id="bk-duration" className="select" value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
          {SESSION_DURATIONS.map((minutes) => <option key={minutes} value={minutes} disabled={minutes > maxMinutes}>{formatDuration(minutes)} · {creditsLabel(minutes / 60)}{minutes > maxMinutes ? ' (Pro)' : ''}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor="bk-note">What do you want to cover? <span className="faint">(optional)</span></label>
        <textarea id="bk-note" className="textarea" rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Your level, goals, anything to prepare…" />
      </div>

      <div className="cost-box">
        <div className="row spread"><span className="muted">Session cost</span><strong>{creditsLabel(cost)}</strong></div>
        <div className="row spread small"><span className="muted">Your spendable balance</span><span className={short ? 'negative-text' : ''}>{formatCredits(available)} credits</span></div>
        <p className="tiny faint">Credits are only held once the teacher confirms, and returned if the session does not happen.</p>
      </div>

      {error && <p className="alert error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary btn-lg" disabled={sending || !valid}>{sending ? <span className="spinner" /> : short ? 'Top up & request' : 'Request session'}</button>
      {short && <p className="tiny faint center">You need {formatCredits(cost - available)} more credit{cost - available === 1 ? '' : 's'}. Choose “Request session” to top up, or teach a session to earn them.</p>}
      {profile.timezone && <p className="tiny faint center">{capitalize(profile.name.split(' ')[0])}’s timezone: {profile.timezone}</p>}
    </form>
  );
}
