import { useEffect, useState } from 'react';
import api from '../api/axios';
import AppShell from '../components/AppShell';

const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

function Browse() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [bookingForm, setBookingForm] = useState(null);
  const [proposedTime, setProposedTime] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadUsers = async () => {
      try { const res = await api.get('/users'); if (!cancelled) setUsers(res.data); }
      catch { if (!cancelled) setError('Failed to load users'); }
      finally { if (!cancelled) setLoading(false); }
    };
    loadUsers();
    return () => { cancelled = true; };
  }, []);

  const openBookingForm = (providerId, skill) => { setBookingForm({ providerId, skill }); setMessage(''); };
  const submitBooking = async (event) => {
    event.preventDefault();
    try {
      await api.post('/bookings', { providerId: bookingForm.providerId, skill: bookingForm.skill, proposedTime: new Date(proposedTime).toISOString() });
      setMessage('Request sent!'); setBookingForm(null); setProposedTime('');
    } catch (err) { setMessage(err.response?.data?.message || 'Failed to send request'); }
  };
  const visibleUsers = users.filter((user) => `${user.name} ${(user.skillsOffered || []).join(' ')}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <AppShell eyebrow="The skill directory" title="Find your next teacher." description="Browse real people, practical skills, and exchanges that fit into your life." action={<span className="match-score">{users.length} people available</span>}>
      {message && <p className="status-message">{message}</p>}
      {error && <p className="status-message error">{error}</p>}
      <div className="filter-bar"><p className="section-kicker" style={{ margin: 0 }}>{loading ? 'Loading the community...' : 'People in the community'}</p><input className="search-input" aria-label="Search skills or people" placeholder="Search skills or people" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      {loading && <div className="empty-state"><strong>Finding your people</strong>Loading the latest skill profiles...</div>}
      {!loading && visibleUsers.length === 0 && <div className="empty-state"><strong>No one matches that search</strong>Try a broader skill or check back soon.</div>}
      <div className="people-grid">{visibleUsers.map((user) => <article className="person-card" key={user._id}><div className="person-top"><span className="avatar">{initials(user.name)}</span><div><h3>{user.name}</h3><p>Open to a thoughtful exchange</p></div></div><div className="skill-group"><small>Can teach</small><div className="skill-tags">{user.skillsOffered?.length ? user.skillsOffered.map((skill) => <span className="skill-tag" key={skill}>{skill}</span>) : <span className="form-hint">Nothing listed yet</span>}</div></div><div className="skill-group"><small>Wants to learn</small><p>{user.skillsWanted?.length ? user.skillsWanted.join(', ') : 'Open to new ideas'}</p></div>{user.skillsOffered?.map((skill) => <button className="primary-button" type="button" key={skill} onClick={() => openBookingForm(user._id, skill)}>Request {skill} <span>→</span></button>)}</article>)}</div>
      {bookingForm && <div className="modal-backdrop"><section className="booking-modal surface"><button className="modal-close" type="button" onClick={() => setBookingForm(null)} aria-label="Close booking form">×</button><p className="page-eyebrow">Start a new exchange</p><h2>Request {bookingForm.skill}</h2><p className="page-description">Choose a time that works for you. The other person can accept or suggest another moment.</p><form onSubmit={submitBooking}><div className="form-field"><label htmlFor="proposed-time">Proposed date and time</label><input id="proposed-time" type="datetime-local" value={proposedTime} onChange={(event) => setProposedTime(event.target.value)} required /></div><div className="stack-actions"><button className="primary-button" type="submit">Send request <span>→</span></button><button className="secondary-button" type="button" onClick={() => setBookingForm(null)}>Cancel</button></div></form></section></div>}
    </AppShell>
  );
}

export default Browse;
