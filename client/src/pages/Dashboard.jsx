import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Icon from '../components/Icon';
import { updateUser } from '../redux/authSlice';
import { fetchNotifications, fetchUnreadCounts, markNotificationRead } from '../redux/notificationSlice';

const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

function Dashboard() {
  const user = useSelector((state) => state.auth.user);
  const authToken = useSelector((state) => state.auth.token);
  const radiusKm = useSelector((state) => state.searchRadius.radiusKm);
  const { isLoaded, isSignedIn } = useAuth();
  const { items: notifications, loading: notificationsLoading } = useSelector((state) => state.notifications);
  const dispatch = useDispatch();
  const [matches, setMatches] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const token = authToken || (isSignedIn ? 'clerk-session' : null);

  const refreshDashboard = useCallback(async (initial = false) => {
    if (!token) return;
    if (initial) setLoading(true);
    const [userResult, matchResult, bookingResult] = await Promise.allSettled([
      api.get('/users/me'),
      api.get(`/matches?radiusKm=${encodeURIComponent(radiusKm)}`),
      api.get('/bookings')
    ]);
    if (!mountedRef.current) return;
    if (userResult.status === 'fulfilled') dispatch(updateUser(userResult.value.data));
    if (matchResult.status === 'fulfilled') setMatches(matchResult.value.data);
    if (bookingResult.status === 'fulfilled') setBookings(bookingResult.value.data);
    if (initial) setLoading(false);
  }, [dispatch, radiusKm, token]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return undefined;
    mountedRef.current = true;
    queueMicrotask(() => refreshDashboard(true));
    const refreshWhenVisible = () => { if (!document.hidden) refreshDashboard(false); };
    const timer = window.setInterval(refreshWhenVisible, 15000);
    window.addEventListener('focus', refreshWhenVisible);
    dispatch(fetchNotifications());
    dispatch(fetchUnreadCounts());
    return () => { mountedRef.current = false; window.clearInterval(timer); window.removeEventListener('focus', refreshWhenVisible); };
  }, [dispatch, isLoaded, isSignedIn, refreshDashboard]);

  const upcoming = bookings.filter((item) => ['pending', 'accepted'].includes(item.status)).slice(0, 3);
  const completed = bookings.filter((item) => item.status === 'completed').length;
  const profileSignals = [user?.bio, user?.skillsOffered?.length, user?.skillsWanted?.length, user?.location?.city];
  const profileScore = Math.round((profileSignals.filter(Boolean).length / profileSignals.length) * 100);
  const matchPercent = (score) => Math.min(100, Math.round((Number(score || 0) / Math.max(user?.skillsWanted?.length || 1, 1)) * 100));
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <AppShell eyebrow="Overview" title={`${greeting}, ${user?.name?.split(' ')[0] || 'there'}.`} description="Your exchanges, opportunities, and community activity at a glance." action={<Link className="primary-button" to="/browse">Discover skills <Icon name="arrow" size={16}/></Link>}>
      <div className="dashboard-container">
        <section className="bento-card bento-kpi bento-kpi-featured col-4"><div className="kpi-container"><span className="kpi-label">Available balance</span><span className="kpi-value">{user?.creditBalance ?? 0}</span><span className="kpi-sub">Credit hours ready to use</span></div><Icon name="wallet" size={20}/></section>
        <section className="bento-card bento-kpi col-4"><div className="kpi-container"><span className="kpi-label">Potential matches</span><span className="kpi-value">{loading ? '—' : matches.length}</span><span className="kpi-sub">Based on your learning goals</span></div><Icon name="users" size={20}/></section>
        <section className="bento-card bento-kpi col-4"><div className="kpi-container"><span className="kpi-label">Completed swaps</span><span className="kpi-value">{loading ? '—' : completed}</span><span className="kpi-sub">Your total learning history</span></div><Icon name="spark" size={20}/></section>

        <section className="bento-card col-8">
          <div className="section-eyebrow">Recommended experts</div>
          {loading ? <div className="bento-loading">Finding the strongest skill overlaps…</div> : <div className="expert-list">{matches.slice(0, 4).map((match) => <Link className="expert-row lift" to={`/profile/${match.id || match._id}`} key={match.id || match._id}><span className="expert-avatar">{initials(match.name)}</span><span className="expert-copy"><strong>{match.name}</strong><small>{match.matchedSkills?.join(' • ') || 'Promising skill overlap'}</small></span><span className="match-percent">{matchPercent(match.score)}% match</span><Icon name="arrow" size={15}/></Link>)}</div>}
          {!loading && matches.length === 0 && <div className="bento-empty"><Icon name="spark" size={22}/><strong>No expert matches yet</strong><span>Add the skills you want to learn to unlock recommendations.</span><Link to="/edit-skills">Complete your profile</Link></div>}
          {matches.length > 0 && <Link className="bento-text-link" to="/browse">Explore all members <Icon name="arrow" size={14}/></Link>}
        </section>

        <aside className="bento-card col-4 profile-activity-card">
          <div className="section-eyebrow">Profile activity</div>
          <div className="expertise-meter"><div><span>Profile strength</span><strong>{profileScore}%</strong></div><div className="meter-track"><i style={{ width: `${profileScore}%` }}/></div><Link to="/edit-skills">Improve your profile</Link></div>
          <div className="next-session"><p className="kpi-label">Next exchanges</p>{upcoming.length ? upcoming.map((booking, index) => <Link to="/bookings" className="session-row" key={booking._id}><span className={index === 0 ? 'status-dot dot-indigo' : 'status-dot dot-grey'}/><span><strong>{booking.skill}</strong><small>{new Date(booking.proposedTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</small></span></Link>) : <div className="bento-empty compact"><span>No sessions planned</span><Link to="/browse">Find an expert</Link></div>}</div>
        </aside>

        <section className="bento-card col-12">
          <div className="section-eyebrow">Recent activity</div>
          {notificationsLoading ? <div className="bento-loading">Loading your activity…</div> : <div className="activity-grid">{notifications.slice(0, 6).map((notification) => <button type="button" className="activity-item" key={notification._id} onClick={() => { if (!notification.read) dispatch(markNotificationRead(notification._id)); }}><span className={`status-dot ${notification.read ? 'dot-grey' : 'dot-indigo'}`}/><span><strong>{notification.message}</strong><small>{new Date(notification.createdAt).toLocaleDateString()}</small></span></button>)}</div>}
          {!notificationsLoading && notifications.length === 0 && <div className="bento-empty compact"><strong>You’re all caught up</strong><span>New booking, message, and credit updates will appear here.</span></div>}
        </section>
      </div>
    </AppShell>
  );
}

export default Dashboard;
