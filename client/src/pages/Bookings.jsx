import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import { updateUser } from '../redux/authSlice';
import { fetchUnreadCounts, markNotificationTypeRead } from '../redux/notificationSlice';

function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [reviewedIds, setReviewedIds] = useState([]);
  const [reviewingId, setReviewingId] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const currentUser = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();

  const fetchAll = async () => {
    try {
      const [bookingsRes, reviewedRes] = await Promise.all([
        api.get('/bookings'),
        api.get('/reviews/mine')
      ]);
      setBookings(bookingsRes.data);
      setReviewedIds(reviewedRes.data);
    } catch {
      setMessage('Failed to load bookings');
    }
  };

  useEffect(() => {
    dispatch(markNotificationTypeRead('booking'));
    let active = true;
    Promise.all([api.get('/bookings'), api.get('/reviews/mine')])
      .then(([bookingsRes, reviewedRes]) => {
        if (!active) return;
        setBookings(bookingsRes.data);
        setReviewedIds(reviewedRes.data);
      })
      .catch(() => {
        if (active) setMessage('Failed to load bookings');
      });
    return () => { active = false; };
  }, [dispatch]);

  const respondToBooking = async (id, status) => {
    try {
      await api.patch(`/bookings/${id}/status`, { status });
      setMessage(`Booking ${status}.`);
      dispatch(fetchUnreadCounts());
      await fetchAll();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Action failed');
    }
  };

  const completeBooking = async (id) => {
    try {
      await api.patch(`/bookings/${id}/complete`);
      const profile = await api.get('/users/me');
      dispatch(updateUser(profile.data));
      dispatch(fetchUnreadCounts());
      setMessage('Session completed — credits transferred!');
      await fetchAll();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Action failed');
    }
  };

  const submitReview = async (bookingId) => {
    try {
      await api.post('/reviews', { bookingId, rating, comment });
      setMessage('Review submitted!');
      setReviewingId(null);
      setComment('');
      await fetchAll();
      dispatch(fetchUnreadCounts());
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to submit review');
    }
  };

  return (
    <AppShell
      eyebrow="Your calendar"
      title="Make time for growth."
      description="Keep every exchange in one place, from the first request to the moment the credits land."
      action={<Link className="primary-button" to="/browse">Find another skill <span>→</span></Link>}
    >
      {message && <p className={`status-message ${/failed|action|insufficient|could not/i.test(message) ? 'error' : ''}`} role="status">{message}</p>}
      {bookings.length === 0 && (
        <div className="empty-state"><strong>No exchanges yet</strong>Head to Discover skills and request your first session.</div>
      )}
      <div className="booking-list">
        {bookings.map((booking) => {
          const isProvider = booking.provider?._id === currentUser?.id;
          const isRequester = booking.requester?._id === currentUser?.id;
          const otherPerson = isProvider ? booking.requester?.name : booking.provider?.name;
          const alreadyReviewed = reviewedIds.includes(booking._id);

          return (
            <article className="booking-card" key={booking._id}>
              <div>
                <h3>{booking.skill}</h3>
                <div className="booking-meta">
                  <span><strong>{isProvider ? 'Teaching' : 'Learning'}</strong> with {otherPerson}</span>
                  <span>{new Date(booking.proposedTime).toLocaleString()}</span>
                </div>
              </div>
              <div className="booking-side">
                <span className={`booking-status ${booking.status}`}>{booking.status}</span>
                <div className="booking-actions">

  {isProvider && booking.status === 'pending' && (
    <>
      <button
        type="button"
        onClick={() => respondToBooking(booking._id, 'accepted')}
      >
        Accept
      </button>

      <button
        type="button"
        onClick={() => respondToBooking(booking._id, 'declined')}
      >
        Decline
      </button>
    </>
  )}


  {isRequester && booking.status === 'accepted' && (
    <button
      type="button"
      onClick={() => completeBooking(booking._id)}
    >
      Complete session
    </button>
  )}


  {booking.status === 'completed' &&
    !alreadyReviewed &&
    reviewingId !== booking._id && (
      <button
        type="button"
        onClick={() => setReviewingId(booking._id)}
      >
        Leave a review
      </button>
    )}


  {booking.status === 'completed' && alreadyReviewed && (
    <span className="form-hint">
      Reviewed ✓
    </span>
  )}


  {(isProvider || isRequester) &&
    (booking.status === 'accepted' || booking.status === 'completed') && (
      <Link
  to={`/messages?with=${
    isProvider
      ? booking.requester?._id
      : booking.provider?._id
  }`}
>
  Message
</Link>
    )}

</div>
              </div>

              {reviewingId === booking._id && (
                <div className="review-panel">
                  <div><strong>How was your exchange?</strong><p>Your feedback helps keep the community thoughtful.</p></div>
                  <div className="star-rating" role="radiogroup" aria-label="Rating">
                    {[1, 2, 3, 4, 5].map((n) => <button type="button" role="radio" aria-checked={rating === n} aria-label={`${n} stars`} className={n <= rating ? 'active' : ''} key={n} onClick={() => setRating(n)}>★</button>)}
                  </div>
                  <textarea
                    placeholder="Share a few words about your experience (optional)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <div className="stack-actions">
                    <button className="primary-button" type="button" onClick={() => submitReview(booking._id)}>Submit</button>
                    <button className="secondary-button" type="button" onClick={() => setReviewingId(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}

export default Bookings;
