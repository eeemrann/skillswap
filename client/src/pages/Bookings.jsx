import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';

function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [reviewedIds, setReviewedIds] = useState([]);
  const [reviewingId, setReviewingId] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const currentUser = useSelector((state) => state.auth.user);

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

  useEffect(() => { fetchAll(); }, []);

  const respondToBooking = async (id, status) => {
    try {
      await api.patch(`/bookings/${id}/status`, { status });
      await fetchAll();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Action failed');
    }
  };

  const completeBooking = async (id) => {
    try {
      await api.patch(`/bookings/${id}/complete`);
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
      {message && <p className="status-message">{message}</p>}
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
        to={`/messages?with=${isProvider ? booking.requester._id : booking.provider._id}`}
      >
        Message
      </Link>
    )}

</div>
              </div>

              {reviewingId === booking._id && (
                <div className="stack-actions" style={{ marginTop: 12, width: '100%' }}>
                  <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
                  </select>
                  <textarea
                    placeholder="Optional comment"
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