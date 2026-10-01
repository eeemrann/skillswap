import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import SessionAction from '../components/SessionAction';
import { perspective } from '../lib/booking';
import { creditsLabel, formatCredits, formatDateTime, formatRelative, idOf } from '../lib/format';
import { useNow, useQuery, useWindowEvent } from '../lib/hooks';
import { fetchNotifications, markNotificationRead } from '../redux/notificationSlice';

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
};

function Kpi({ label, value, hint, icon, tone = '' }) {
  return (
    <div className={`card card-pad kpi ${tone}`}>
      <span className="kpi-icon"><Icon name={icon} size={20} /></span>
      <div className="stack" style={{ '--gap': '2px' }}>
        <span className="small muted">{label}</span>
        <strong className="kpi-value nums">{value}</strong>
        {hint && <span className="tiny faint">{hint}</span>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const user = useSelector((state) => state.auth.user);
  const notifications = useSelector((state) => state.notifications.items);
  const dispatch = useDispatch();
  const now = useNow(30000);
  const userId = idOf(user);

  const matches = useQuery(() => api.get('/matches').then((r) => r.data), [], { interval: 60000 });
  const bookings = useQuery(() => api.get('/bookings').then((r) => r.data), [], { interval: 20000 });
  useWindowEvent('skillswap:refresh', () => bookings.reload());
  useEffect(() => { dispatch(fetchNotifications()); }, [dispatch]);

  const list = useMemo(() => bookings.data || [], [bookings.data]);
  const upcoming = useMemo(() => list.filter((b) => b.status === 'accepted' && new Date(b.joinClosesAt).getTime() >= now).sort((a, b) => new Date(a.proposedTime) - new Date(b.proposedTime)), [list, now]);
  const toConfirm = list.filter((b) => b.status === 'accepted' && new Date(b.proposedTime).getTime() <= now && perspective(b, userId).role === 'learner');
  const requests = list.filter((b) => b.status === 'pending' && perspective(b, userId).role === 'teacher');
  const completed = list.filter((b) => b.status === 'completed').length;
  const next = upcoming[0];

  const checklist = [
    { done: Boolean(user?.bio), label: 'Write a short introduction', to: '/settings' },
    { done: Boolean(user?.skillsOffered?.length), label: 'List a skill you can teach', to: '/settings' },
    { done: Boolean(user?.skillsWanted?.length), label: 'List a skill you want to learn', to: '/settings' },
    { done: Boolean(user?.availability?.length), label: 'Add your weekly availability', to: '/settings' },
    { done: Boolean(user?.location?.city), label: 'Add your city (optional)', to: '/settings' }
  ];
  const strength = Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100);
  const held = user?.creditsHeld || 0;

  return (
    <AppShell eyebrow="Overview" title={`${greeting()}, ${user?.name?.split(' ')[0] || 'there'}`} description="Your sessions, matches and wallet at a glance."
      action={<Link className="btn btn-primary" to="/browse"><Icon name="search" size={16} /> Find a teacher</Link>}>
      <div className="stack" style={{ '--gap': '24px' }}>
        {(requests.length > 0 || toConfirm.length > 0) && (
          <div className="stack" style={{ '--gap': '10px' }}>
            {requests.length > 0 && <Link to="/bookings" className="alert warning action-alert"><Icon name="bell" /><span className="grow"><strong>{requests.length} session {requests.length === 1 ? 'request needs' : 'requests need'} your answer.</strong> Members are waiting to hear back.</span><Icon name="arrow" /></Link>}
            {toConfirm.length > 0 && <Link to="/bookings" className="alert success action-alert"><Icon name="checkCircle" /><span className="grow"><strong>Confirm {toConfirm.length === 1 ? 'your session' : `${toConfirm.length} sessions`}</strong> to release credits to your teacher.</span><Icon name="arrow" /></Link>}
          </div>
        )}

        <div className="grid cols-4">
          <Kpi label="Spendable credits" value={formatCredits(user?.availableCredits ?? user?.creditBalance ?? 0)} hint={held > 0 ? `${creditsLabel(held)} held for confirmed sessions` : '1 credit = 1 hour'} icon="wallet" tone="credit" />
          <Kpi label="Upcoming sessions" value={bookings.loading ? '–' : upcoming.length} hint={next ? `Next ${formatRelative(next.proposedTime, now)}` : 'Nothing scheduled'} icon="calendar" />
          <Kpi label="Sessions completed" value={bookings.loading ? '–' : completed} hint="Taught and learned" icon="checkCircle" />
          <Kpi label="Profile strength" value={`${strength}%`} hint={strength === 100 ? 'Looking great' : 'Complete it to get matched'} icon="user" />
        </div>

        <div className="split">
          <div className="stack" style={{ '--gap': '24px' }}>
            <section className="card card-pad">
              <div className="card-head"><h2 className="card-title">{next ? 'Your next session' : 'Upcoming sessions'}</h2><Link to="/bookings" className="small">All sessions</Link></div>
              {bookings.loading ? <div className="skeleton" style={{ height: 96 }} /> : next ? (
                <div className="stack" style={{ '--gap': '14px' }}>
                  {upcoming.slice(0, 3).map((booking, index) => {
                    const { role, other } = perspective(booking, userId);
                    return (
                      <div className={`next-session ${index === 0 ? 'primary' : ''}`} key={booking._id}>
                        <Avatar name={other?.name} src={other?.profilePicture} size="lg" />
                        <div className="grow stack" style={{ '--gap': '2px' }}>
                          <strong className="truncate">{booking.skill}</strong>
                          <span className="small muted truncate">{role === 'learner' ? 'Learning from' : 'Teaching'} {other?.name} · {formatDateTime(booking.proposedTime)}</span>
                        </div>
                        <SessionAction booking={booking} now={now} size="btn-sm" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon="video" title="No sessions planned" action={<Link className="btn btn-primary" to="/browse">Book your first session</Link>}>Find a teacher, pick a time, and meet on video.</EmptyState>
              )}
            </section>

            <section className="card card-pad">
              <div className="card-head"><div><h2 className="card-title">Recommended for you</h2><p className="small muted">People who teach what you want to learn</p></div><Link to="/browse" className="small">Browse all</Link></div>
              {matches.loading ? <div className="grid cols-2">{[1, 2, 3, 4].map((n) => <div key={n} className="skeleton" style={{ height: 88 }} />)}</div>
                : matches.data?.length ? (
                  <div className="grid cols-2" style={{ '--gap': '12px' }}>
                    {matches.data.slice(0, 6).map((match) => (
                      <Link className="match-card" to={`/profile/${match.id}`} key={match.id}>
                        <Avatar name={match.name} src={match.profilePicture} size="lg" />
                        <div className="grow stack" style={{ '--gap': '3px', minWidth: 0 }}>
                          <span className="row nowrap" style={{ gap: 6 }}><strong className="truncate">{match.name}</strong>{match.isPro && <span className="badge pro">Pro</span>}</span>
                          <span className="small muted truncate">{match.matchedSkills.join(' · ')}</span>
                          <span className="row" style={{ gap: 6 }}>
                            {match.mutualSkills?.length > 0 && <span className="badge success"><Icon name="swap" size={11} /> Mutual swap</span>}
                            {match.matchReasons.includes('Availability overlaps') && <span className="badge"><Icon name="clock" size={11} /> Schedules fit</span>}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon="spark" title="No matches yet" action={<Link className="btn btn-secondary" to="/settings">Add skills you want to learn</Link>}>List what you want to learn and we will find people who teach it.</EmptyState>
                )}
            </section>
          </div>

          <div className="stack" style={{ '--gap': '24px' }}>
            {strength < 100 && (
              <section className="card card-pad">
                <div className="card-head"><h2 className="card-title">Finish your profile</h2><strong>{strength}%</strong></div>
                <div className="progress" role="progressbar" aria-valuenow={strength} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${strength}%` }} /></div>
                <ul className="checklist">
                  {checklist.map((item) => <li key={item.label} className={item.done ? 'done' : ''}><Icon name={item.done ? 'checkCircle' : 'clock'} size={16} />{item.done ? <span>{item.label}</span> : <Link to={item.to}>{item.label}</Link>}</li>)}
                </ul>
              </section>
            )}

            {user?.effectivePlan !== 'pro' && (
              <section className="card card-pad upsell-card">
                <span className="badge pro"><Icon name="crown" size={12} /> Pro</span>
                <h3>Teach more, keep more</h3>
                <p className="small">4 credits a month, no 10% service fee, and your profile shown first in Discover.</p>
                <Link className="btn btn-primary btn-sm" to="/billing">Compare plans</Link>
              </section>
            )}

            <section className="card card-pad">
              <div className="card-head"><h2 className="card-title">Recent activity</h2></div>
              {notifications.length ? (
                <ul className="activity">
                  {notifications.slice(0, 6).map((item) => (
                    <li key={item._id}>
                      <button type="button" onClick={() => { if (!item.read) dispatch(markNotificationRead(item._id)); }}>
                        <i className={item.read ? '' : 'unread'} />
                        <span className="grow stack" style={{ '--gap': '1px', textAlign: 'left' }}><span className="small">{item.message}</span><span className="tiny faint">{formatRelative(item.createdAt, now)}</span></span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="small muted">You are all caught up.</p>}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
