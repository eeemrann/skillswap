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
  const [actingId, setActingId] = useState(null);
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
    } catch { if (mountedRef.current) setMessage('Failed to sync schedule.'); }
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

  const respond = async (id, status) => {
    setActingId(id);
    try {
      await api.patch(`/bookings/${id}/status`, { status });
      setMessage(`Session ${status}.`);
      dispatch(fetchUnreadCounts());
      await fetchAll();
    } catch (error) { setMessage(error.response?.data?.message || 'Action failed.'); }
    finally { setActingId(null); }
  };

  const complete = async (id) => {
    setActingId(id);
    try {
      await api.patch(`/bookings/${id}/complete`);
      const { data } = await api.get('/users/me');
      dispatch(updateUser(data));
      dispatch(fetchUnreadCounts());
      setMessage('Session completed — credits transferred.');
      await fetchAll();
    } catch (error) { setMessage(error.response?.data?.message || 'Action failed.'); }
    finally { setActingId(null); }
  };

  const submitReview = async (bookingId) => {
    setActingId(bookingId);
    try {
      await api.post('/reviews', { bookingId, rating, comment });
      setMessage('Review submitted.');
      setReviewingId(null);
      setComment('');
      setRating(5);
      await fetchAll();
      dispatch(fetchUnreadCounts());
    } catch (error) { setMessage(error.response?.data?.message || 'Failed to submit review.'); }
    finally { setActingId(null); }
  };

  const currentUserId = currentUser?._id || currentUser?.id;
  const teaching = bookings.filter((booking) => partyId(booking.provider) === currentUserId);
  const learning = bookings.filter((booking) => partyId(booking.requester) === currentUserId);

  const renderBooking = (booking, isTeaching) => {
    const other = isTeaching ? booking.requester : booking.provider;
    const otherName = other?.name || 'SkillSwap member';
    const otherId = partyId(other);
    const date = new Date(booking.proposedTime);
    const isReviewing = reviewingId === booking._id;
    const alreadyReviewed = reviewedIds.includes(booking._id);
    const isActing = actingId === booking._id;

    return <article className={`foundry-card timeline-card growth-timeline-card ${booking.status}`} key={booking._id}>
      <div className="timeline-card-main">
        <div className="timeline-date-box"><span>{date.toLocaleDateString([], { month: 'short' })}</span><strong>{date.toLocaleDateString([], { day: '2-digit' })}</strong></div>
        <div className="timeline-copy"><div className="timeline-meta"><span className={`f-badge ${booking.status === 'accepted' || booking.status === 'completed' ? 'active' : 'pending'}`}>{booking.status}</span><span>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><h3>{booking.skill}</h3><p>{isTeaching ? 'Teaching' : 'Learning from'} <strong>{otherName}</strong></p></div>
      </div>
      <div className="booking-actions-group">
        {isTeaching && booking.status === 'pending' && <div className="action-pair"><button className="primary-button" type="button" disabled={isActing} onClick={() => respond(booking._id, 'accepted')}>Accept</button><button className="secondary-button" type="button" disabled={isActing} onClick={() => respond(booking._id, 'declined')}>Decline</button></div>}
        {!isTeaching && booking.status === 'accepted' && <button className="primary-button" type="button" disabled={isActing} onClick={() => complete(booking._id)}>Complete</button>}
        {['accepted', 'completed'].includes(booking.status) && otherId && <Link className="ghost-button" to={`/messages?with=${otherId}`} aria-label={`Message ${otherName}`}><Icon name="message" size={14}/></Link>}
        {booking.status === 'completed' && !alreadyReviewed && !isReviewing && <button className="secondary-button" type="button" onClick={() => setReviewingId(booking._id)}>Review</button>}
        {booking.status === 'completed' && alreadyReviewed && <span className="reviewed-label">Reviewed <span aria-hidden="true">✓</span></span>}
      </div>
      {isReviewing && <div className="timeline-review foundry-card"><div><strong>How was the exchange?</strong><p>Your feedback helps maintain a thoughtful expert community.</p></div><div className="star-rating" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((value) => <button type="button" role="radio" aria-checked={rating === value} aria-label={`${value} stars`} className={value <= rating ? 'active' : ''} key={value} onClick={() => setRating(value)}>★</button>)}</div><textarea className="review-textarea foundry-textarea" placeholder="Add your feedback…" value={comment} onChange={(event) => setComment(event.target.value)}/><div className="stack-actions"><button className="primary-button" type="button" disabled={isActing} onClick={() => submitReview(booking._id)}>{isActing ? 'Submitting…' : 'Submit review'}</button><button className="ghost-button" type="button" onClick={() => setReviewingId(null)}>Cancel</button></div></div>}
    </article>;
  };

  return <AppShell eyebrow="QUEUE_MANAGEMENT" title="Strategic Timeline" description="Inbound expertise requests and outbound knowledge acquisition." action={<Link className="primary-button" to="/browse">Find an expert <Icon name="arrow" size={15}/></Link>}>
    {message && <p className={`status-message ${/failed|action|insufficient|could not/i.test(message) ? 'error' : ''}`} role="status">{message}</p>}
    <div className="booking-summary"><span><strong>{teaching.filter((item) => item.status === 'pending').length}</strong> requests need attention</span><span><strong>{learning.filter((item) => item.status === 'accepted').length}</strong> sessions ready to complete</span></div>
    <div className="strategic-timeline page-enter">
      <section className="timeline-pane"><div className="timeline-heading"><div><span className="timeline-icon incoming"><Icon name="spark" size={16}/></span><div><h2>Expertise Requests</h2><p>Mentoring · Incoming</p></div></div><span>{teaching.length}</span></div>{loading ? <div className="timeline-loading"/> : teaching.length ? <div className="timeline-list">{teaching.map((booking) => renderBooking(booking, true))}</div> : <div className="empty-state-premium"><Icon name="spark" size={20}/><strong>No mentorship requests yet</strong><span>New requests from learners will appear here.</span></div>}</section>
      <section className="timeline-pane"><div className="timeline-heading"><div><span className="timeline-icon outgoing"><Icon name="search" size={16}/></span><div><h2>Learning Path</h2><p>Learning · Outgoing</p></div></div><span>{learning.length}</span></div>{loading ? <div className="timeline-loading"/> : learning.length ? <div className="timeline-list">{learning.map((booking) => renderBooking(booking, false))}</div> : <div className="empty-state-premium"><Icon name="search" size={20}/><strong>Your learning path is open</strong><span>Request a skill to begin your next exchange.</span><Link className="secondary-button" to="/browse">Find Expertise</Link></div>}</section>
    </div>
  </AppShell>;
}

export default Bookings;
