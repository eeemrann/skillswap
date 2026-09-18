import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';

function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState('');
  const currentUser = useSelector((state) => state.auth.user);
  const fetchBookings = async () => { try { const res = await api.get('/bookings'); setBookings(res.data); } catch { setMessage('Failed to load bookings'); } };
  useEffect(() => { let cancelled = false; const loadBookings = async () => { try { const res = await api.get('/bookings'); if (!cancelled) setBookings(res.data); } catch { if (!cancelled) setMessage('Failed to load bookings'); } }; loadBookings(); return () => { cancelled = true; }; }, []);
  const respondToBooking = async (id, status) => { try { await api.patch(`/bookings/${id}/status`, { status }); await fetchBookings(); } catch (err) { setMessage(err.response?.data?.message || 'Action failed'); } };
  const completeBooking = async (id) => { try { await api.patch(`/bookings/${id}/complete`); setMessage('Session completed — credits transferred!'); await fetchBookings(); } catch (err) { setMessage(err.response?.data?.message || 'Action failed'); } };

  return (
    <AppShell eyebrow="Your calendar" title="Make time for growth." description="Keep every exchange in one place, from the first request to the moment the credits land." action={<Link className="primary-button" to="/browse">Find another skill <span>→</span></Link>}>
      {message && <p className="status-message">{message}</p>}
      {bookings.length === 0 && <div className="empty-state"><strong>No exchanges yet</strong>Head to Discover skills and request your first session.</div>}
      <div className="booking-list">{bookings.map((booking) => { const isProvider = booking.provider?._id === currentUser?.id; const isRequester = booking.requester?._id === currentUser?.id; const otherPerson = isProvider ? booking.requester?.name : booking.provider?.name; return <article className="booking-card" key={booking._id}><div><h3>{booking.skill}</h3><div className="booking-meta"><span><strong>{isProvider ? 'Teaching' : 'Learning'}</strong> with {otherPerson}</span><span>{new Date(booking.proposedTime).toLocaleString()}</span></div></div><div className="booking-side"><span className={`booking-status ${booking.status}`}>{booking.status}</span><div className="booking-actions">{isProvider && booking.status === 'pending' && <><button type="button" onClick={() => respondToBooking(booking._id, 'accepted')}>Accept</button><button type="button" onClick={() => respondToBooking(booking._id, 'declined')}>Decline</button></>}{isRequester && booking.status === 'accepted' && <button type="button" onClick={() => completeBooking(booking._id)}>Complete session</button>}</div></div></article>; })}</div>
    </AppShell>
  );
}

export default Bookings;
