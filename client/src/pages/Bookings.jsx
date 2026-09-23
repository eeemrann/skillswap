import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Icon from '../components/Icon';
import { updateUser } from '../redux/authSlice';
import { fetchUnreadCounts, markNotificationTypeRead } from '../redux/notificationSlice';

const partyId = (party) => typeof party === 'string' ? party : party?._id;

function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [reviewedIds, setReviewedIds] = useState([]);
  const [reviewingId, setReviewingId] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const currentUser = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const mountedRef = useRef(true);

  const fetchAll = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const [bookingsResult, reviewedResult] = await Promise.all([api.get('/bookings'), api.get('/reviews/mine')]);
      if (!mountedRef.current) return;
      setBookings(bookingsResult.data);
      setReviewedIds(reviewedResult.data);
    } catch { if (mountedRef.current) setMessage('Failed to load sessions.'); }
    finally { if (mountedRef.current && initial) setLoading(false); }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    dispatch(markNotificationTypeRead('booking'));
    queueMicrotask(() => fetchAll(true));
    const refresh = () => { if (!document.hidden) fetchAll(false); };
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    return () => { mountedRef.current = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [dispatch, fetchAll]);

  const respondToBooking = async (id, status) => {
    try {
      await api.patch(`/bookings/${id}/status`, { status });
      setMessage(`Session ${status}.`);
      dispatch(fetchUnreadCounts());
      await fetchAll();
    } catch (err) { setMessage(err.response?.data?.message || 'Action failed.'); }
  };

  const completeBooking = async (id) => {
    try {
      await api.patch(`/bookings/${id}/complete`);
      const { data } = await api.get('/users/me');
      dispatch(updateUser(data));
      dispatch(fetchUnreadCounts());
      setMessage('Session completed — credits transferred.');
      await fetchAll();
    } catch (err) { setMessage(err.response?.data?.message || 'Action failed.'); }
  };

  const submitReview = async (bookingId) => {
    try {
      await api.post('/reviews', { bookingId, rating, comment });
      setMessage('Review submitted.');
      setReviewingId(null); setComment(''); setRating(5);
      await fetchAll();
      dispatch(fetchUnreadCounts());
    } catch (err) { setMessage(err.response?.data?.message || 'Failed to submit review.'); }
  };

  const currentUserId = currentUser?._id || currentUser?.id;
  const teaching = bookings.filter((booking) => partyId(booking.provider) === currentUserId);
  const learning = bookings.filter((booking) => partyId(booking.requester) === currentUserId);

  const renderBooking = (booking, type) => {
    const isProvider = type === 'teaching';
    const otherParty = isProvider ? booking.requester : booking.provider;
    const otherPerson = otherParty?.name || 'SkillSwap member';
    const otherPersonId = partyId(otherParty);
    const alreadyReviewed = reviewedIds.includes(booking._id);
    const isReviewing = reviewingId === booking._id;
    const date = new Date(booking.proposedTime);
    return <article className={`timeline-card ${booking.status}`} key={booking._id}>
      <div className="timeline-card-main"><div className="timeline-date"><span>{date.toLocaleDateString([], { month: 'short' })}</span><strong>{date.toLocaleDateString([], { day: '2-digit' })}</strong></div><div className="timeline-copy"><div className="timeline-meta"><span className={`badge-premium ${booking.status}`}>{booking.status}</span><span>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><h3>{booking.skill}</h3><p>{isProvider ? 'Teaching' : 'Learning from'} <strong>{otherPerson}</strong></p></div></div>
      <div className="booking-actions-group">
        {isProvider && booking.status === 'pending' && <div className="action-pair"><button className="primary-button" type="button" onClick={() => respondToBooking(booking._id, 'accepted')}>Accept</button><button className="secondary-button" type="button" onClick={() => respondToBooking(booking._id, 'declined')}>Decline</button></div>}
        {!isProvider && booking.status === 'accepted' && <button className="primary-button" type="button" onClick={() => completeBooking(booking._id)}>Mark completed</button>}
        {['accepted', 'completed'].includes(booking.status) && otherPersonId && <Link className="ghost-button" to={`/messages?with=${otherPersonId}`}><Icon name="message" size={14}/> Message</Link>}
        {booking.status === 'completed' && !alreadyReviewed && !isReviewing && <button className="secondary-button" type="button" onClick={() => setReviewingId(booking._id)}>Leave review</button>}
        {booking.status === 'completed' && alreadyReviewed && <span className="reviewed-label">Reviewed <span aria-hidden="true">✓</span></span>}
      </div>
      {isReviewing && <div className="timeline-review"><div><strong>How was the exchange?</strong><p>Your feedback helps maintain a thoughtful expert community.</p></div><div className="star-rating" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((value) => <button type="button" role="radio" aria-checked={rating === value} aria-label={`${value} stars`} className={value <= rating ? 'active' : ''} key={value} onClick={() => setRating(value)}>★</button>)}</div><textarea className="review-textarea" placeholder="Add a comment (optional)…" value={comment} onChange={(event) => setComment(event.target.value)}/><div className="stack-actions"><button className="primary-button" type="button" onClick={() => submitReview(booking._id)}>Submit review</button><button className="ghost-button" type="button" onClick={() => setReviewingId(null)}>Cancel</button></div></div>}
    </article>;
  };

  return <AppShell eyebrow="Schedule" title="Manage your time." description="A clear view of what needs your attention and where your learning is heading." action={<Link className="primary-button" to="/browse">Find an expert <Icon name="arrow" size={15}/></Link>}>
    {message && <p className={`status-message ${/failed|action|insufficient|could not/i.test(message) ? 'error' : ''}`} role="status">{message}</p>}
    <div className="booking-summary"><span><strong>{teaching.filter((item) => item.status === 'pending').length}</strong> requests need attention</span><span><strong>{learning.filter((item) => item.status === 'accepted').length}</strong> sessions ready to complete</span></div>
    <div className="strategic-timeline">
      <section className="timeline-pane"><div className="timeline-heading"><div><span className="timeline-icon incoming"><Icon name="spark" size={16}/></span><div><h2>Requests for you</h2><p>Teaching · Incoming</p></div></div><span>{teaching.length}</span></div>{loading ? <div className="timeline-loading"/> : teaching.length ? <div className="timeline-list">{teaching.map((booking) => renderBooking(booking, 'teaching'))}</div> : <div className="empty-state-premium"><Icon name="spark" size={20}/><strong>No teaching requests yet</strong><span>New requests from learners will appear here.</span></div>}</section>
      <section className="timeline-pane"><div className="timeline-heading"><div><span className="timeline-icon outgoing"><Icon name="search" size={16}/></span><div><h2>Your learning path</h2><p>Learning · Outgoing</p></div></div><span>{learning.length}</span></div>{loading ? <div className="timeline-loading"/> : learning.length ? <div className="timeline-list">{learning.map((booking) => renderBooking(booking, 'learning'))}</div> : <div className="empty-state-premium"><Icon name="search" size={20}/><strong>Your learning path is open</strong><span>Request a skill to begin your next exchange.</span><Link className="secondary-button" to="/browse">Explore experts</Link></div>}</section>
    </div>
  </AppShell>;
}

export default Bookings;
