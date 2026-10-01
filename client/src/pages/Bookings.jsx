import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import SessionAction from '../components/SessionAction';
import { joinState, perspective, STATUS_META } from '../lib/booking';
import { creditsLabel, errorMessage, formatDateTime, formatDuration, idOf } from '../lib/format';
import { useNow, useQuery, useWindowEvent } from '../lib/hooks';
import { useToast } from '../lib/toast';
import { updateUser } from '../redux/authSlice';
import { fetchUnreadCounts, markNotificationTypeRead } from '../redux/notificationSlice';

const TABS = [['upcoming', 'Upcoming'], ['requests', 'Requests'], ['history', 'History']];

function ReviewDialog({ booking, otherName, onClose, onDone }) {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/reviews', { bookingId: booking._id, rating, comment });
      toast.success('Thanks for your review');
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, 'Your review could not be saved.'));
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`How was your session with ${otherName}?`} description="Reviews are public and help the community.">
      <form className="stack" style={{ '--gap': '16px' }} onSubmit={submit}>
        <div className="star-picker" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} role="radio" aria-checked={rating === value} aria-label={`${value} star${value > 1 ? 's' : ''}`} className={value <= rating ? 'on' : ''} onClick={() => setRating(value)}>★</button>)}
        </div>
        <textarea className="textarea" rows={4} maxLength={1000} placeholder="What went well? (optional)" value={comment} onChange={(event) => setComment(event.target.value)} aria-label="Comment" />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" /> : 'Submit review'}</button>
        </div>
      </form>
    </Modal>
  );
}

function BookingCard({ booking, userId, now, reviewed, busyId, onAccept, onDecline, onCancel, onConfirm, onReview }) {
  const { role, other } = perspective(booking, userId);
  const meta = STATUS_META[booking.status] || STATUS_META.pending;
  const start = new Date(booking.proposedTime);
  const state = booking.status === 'accepted' ? joinState(booking, now) : null;
  const busy = busyId === booking._id;
  const started = start.getTime() <= now;
  const ended = new Date(booking.endsAt).getTime() <= now;
  const actionable = ['pending', 'accepted'].includes(booking.status);

  return (
    <article className={`booking card ${booking.status}`}>
      <div className="booking-date" aria-hidden="true"><span>{start.toLocaleDateString([], { month: 'short' })}</span><strong>{start.getDate()}</strong></div>
      <div className="grow stack" style={{ '--gap': '8px', minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className={`badge ${meta.tone}`}>{meta.label}</span>
          <span className="badge">{role === 'learner' ? 'Learning' : 'Teaching'}</span>
          {booking.status === 'accepted' && state?.phase === 'open' && state.live && <span className="badge success live-badge">Live now</span>}
        </div>
        <h3 className="booking-title">{booking.skill}</h3>
        <div className="row small muted" style={{ gap: 14 }}>
          <Link className="row nowrap" style={{ gap: 8, color: 'inherit' }} to={`/profile/${idOf(other)}`}><Avatar name={other?.name} src={other?.profilePicture} size="xs" />{other?.name || 'Member'}</Link>
          <span><Icon name="clock" size={13} /> {formatDateTime(start)} · {formatDuration(booking.durationMinutes)}</span>
          <span><Icon name="wallet" size={13} /> {creditsLabel(booking.credits ?? 1)}</span>
        </div>
        {booking.note && <p className="small muted note">“{booking.note}”</p>}
        {booking.status === 'accepted' && role === 'teacher' && started && <p className="tiny faint">Waiting for the learner to confirm. The session settles automatically 24 hours after it ends if you both attended.</p>}
        {booking.status === 'accepted' && role === 'learner' && started && booking.attendedBy && !booking.attendedBy.provider && state?.phase === 'over' && <p className="tiny warn-text">Your teacher did not join. You can cancel to get your credits back.</p>}
        {booking.cancelReason && <p className="tiny faint">Reason: {booking.cancelReason}</p>}
      </div>

      <div className="booking-actions">
        {booking.status === 'pending' && role === 'teacher' && <>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onAccept(booking)}>Accept</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => onDecline(booking)}>Decline</button>
        </>}
        {booking.status === 'pending' && role === 'learner' && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onCancel(booking)}>Cancel request</button>}
        {booking.status === 'accepted' && <>
          <SessionAction booking={booking} now={now} size="btn-sm" />
          {role === 'learner' && started && <button type="button" className="btn btn-success btn-sm" disabled={busy} onClick={() => onConfirm(booking)}><Icon name="check" size={15} /> Confirm & pay</button>}
        </>}
        {actionable && booking.status === 'accepted' && !(booking.sessionHeld && ended) && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onCancel(booking)}>Cancel</button>}
        {['accepted', 'completed'].includes(booking.status) && <Link className="btn btn-ghost btn-sm" to={`/messages?with=${idOf(other)}`}><Icon name="message" size={15} /> Message</Link>}
        {booking.status === 'completed' && (reviewed ? <span className="small faint"><Icon name="check" size={14} /> Reviewed</span> : <button type="button" className="btn btn-secondary btn-sm" onClick={() => onReview(booking)}><Icon name="star" size={15} /> Review</button>)}
      </div>
    </article>
  );
}

export default function Bookings() {
  const user = useSelector((state) => state.auth.user);
  const userId = idOf(user);
  const dispatch = useDispatch();
  const toast = useToast();
  const now = useNow(15000);
  const [tab, setTab] = useState('upcoming');
  const [busyId, setBusyId] = useState('');
  const [reviewing, setReviewing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState('');

  const bookings = useQuery(() => api.get('/bookings', { params: { limit: 100 } }).then((r) => r.data), [], { interval: 15000 });
  const reviewed = useQuery(() => api.get('/reviews/mine').then((r) => r.data), []);
  useWindowEvent('skillswap:refresh', () => bookings.reload());

  const groups = useMemo(() => {
    const list = bookings.data || [];
    const byTime = (a, b) => new Date(a.proposedTime) - new Date(b.proposedTime);
    return {
      upcoming: list.filter((b) => b.status === 'accepted').sort(byTime),
      requests: list.filter((b) => b.status === 'pending').sort(byTime),
      history: list.filter((b) => !['accepted', 'pending'].includes(b.status)).sort((a, b) => byTime(b, a))
    };
  }, [bookings.data]);

  // Opening this page clears booking badges.
  useEffect(() => { dispatch(markNotificationTypeRead('booking')); dispatch(markNotificationTypeRead('session')); }, [dispatch]);

  const act = async (booking, request, success) => {
    setBusyId(booking._id);
    try {
      const response = await request();
      toast.success(response?.data?.message || success);
      const profile = await api.get('/users/me');
      dispatch(updateUser(profile.data));
      dispatch(fetchUnreadCounts());
      bookings.reload();
      return true;
    } catch (error) {
      if (error.response?.status !== 402) toast.error(errorMessage(error, 'That action could not be completed.'));
      return false;
    } finally {
      setBusyId('');
    }
  };

  const accept = (booking) => act(booking, () => api.patch(`/bookings/${booking._id}/status`, { status: 'accepted' }), 'Session confirmed. The video room opens shortly before the start.');
  const decline = (booking) => act(booking, () => api.patch(`/bookings/${booking._id}/status`, { status: 'declined' }), 'Request declined.');
  const confirm = (booking) => act(booking, () => api.patch(`/bookings/${booking._id}/complete`), 'Session confirmed.');
  const cancel = async () => {
    const booking = cancelling;
    if (await act(booking, () => api.patch(`/bookings/${booking._id}/cancel`, { reason }), 'Booking cancelled. Any held credits were returned.')) { setCancelling(null); setReason(''); }
  };

  const current = groups[tab];
  const empty = {
    upcoming: ['calendar', 'No upcoming sessions', 'Find a teacher and book your first live session.', <Link key="b" className="btn btn-primary" to="/browse">Discover teachers</Link>],
    requests: ['spark', 'No pending requests', 'Requests you send or receive will wait here for a reply.', null],
    history: ['clock', 'Nothing here yet', 'Completed, cancelled and declined sessions appear here.', null]
  }[tab];

  return (
    <AppShell eyebrow="Sessions" title="Your sessions" description="Join live video sessions, answer requests and confirm completed lessons."
      action={<Link className="btn btn-primary" to="/browse"><Icon name="plus" size={16} /> Book a session</Link>}>
      <div className="stack" style={{ '--gap': '20px' }}>
        <div className="tabs" role="tablist">
          {TABS.map(([key, label]) => (
            <button type="button" role="tab" className="tab" key={key} aria-selected={tab === key} onClick={() => setTab(key)}>
              {label}{key === 'requests' && groups.requests.length > 0 && <span className="count">{groups.requests.length}</span>}
            </button>
          ))}
        </div>

        {bookings.error && !bookings.data && <p className="alert error" role="alert">Sessions could not be loaded. <button type="button" className="btn btn-sm btn-secondary" onClick={bookings.reload}>Retry</button></p>}
        {bookings.loading ? <div className="stack">{[1, 2, 3].map((n) => <div key={n} className="skeleton" style={{ height: 112 }} />)}</div>
          : current.length === 0 ? <div className="card"><EmptyState icon={empty[0]} title={empty[1]} action={empty[3]}>{empty[2]}</EmptyState></div>
            : <div className="stack" style={{ '--gap': '14px' }}>{current.map((booking) => (
              <BookingCard key={booking._id} booking={booking} userId={userId} now={now} reviewed={(reviewed.data || []).includes(booking._id)} busyId={busyId}
                onAccept={accept} onDecline={decline} onCancel={setCancelling} onConfirm={confirm} onReview={setReviewing} />
            ))}</div>}
      </div>

      {reviewing && <ReviewDialog booking={reviewing} otherName={perspective(reviewing, userId).other?.name || 'your partner'} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); reviewed.reload(); }} />}
      <Modal open={Boolean(cancelling)} onClose={() => setCancelling(null)} title="Cancel this session?" description="The other member will be notified and any held credits go back to the learner.">
        <div className="stack" style={{ '--gap': '14px' }}>
          <textarea className="textarea" rows={3} maxLength={300} placeholder="Reason (optional)" value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Cancellation reason" />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setCancelling(null)}>Keep session</button>
            <button type="button" className="btn btn-danger" disabled={busyId === cancelling?._id} onClick={cancel}>Cancel session</button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
