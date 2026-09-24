import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Icon from '../components/Icon';
import { updateUser } from '../redux/authSlice';
import { fetchNotifications, fetchUnreadCounts } from '../redux/notificationSlice';

const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

function Dashboard() {
  const user = useSelector((state) => state.auth.user);
  const authToken = useSelector((state) => state.auth.token);
  const radiusKm = useSelector((state) => state.searchRadius.radiusKm);
  const { isLoaded, isSignedIn } = useAuth();
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
      api.get('/users/me'), api.get(`/matches?radiusKm=${encodeURIComponent(radiusKm)}`), api.get('/bookings')
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

  const completed = bookings.filter((booking) => booking.status === 'completed').length;
  const profileSignals = [user?.bio, user?.skillsOffered?.length, user?.skillsWanted?.length, user?.location?.city];
  const profileScore = Math.round((profileSignals.filter(Boolean).length / profileSignals.length) * 100);
  const matchPercent = (score) => Math.min(100, Math.round((Number(score || 0) / Math.max(user?.skillsWanted?.length || 1, 1)) * 100));

  return (
    <AppShell eyebrow="SYSTEM_STATUS: OPERATIONAL" title="Overview" description={`Command interface for ${user?.name?.split(' ')[0] || 'Expert'}.`}>
      <div className="foundry-grid">
        <article className="foundry-card col-4"><span className="mono-label">Credit Reserve</span><div className="mono-value">{user?.creditBalance ?? 0}<span>.0</span></div><p className="foundry-muted">Verified time credits available</p></article>
        <article className="foundry-card col-4"><span className="mono-label">Match Signals</span><div className="mono-value">{loading ? '—' : matches.length}</div><p className="foundry-muted">Engine-detected expertise overlap</p></article>
        <article className="foundry-card col-4 foundry-status-card"><span className="mono-label">Exchange Output</span><div className="mono-value">{loading ? '—' : completed}</div><div className="network-state"><i/><span>Network Online</span></div></article>

        <section className="foundry-card col-8">
          <div className="foundry-card-heading"><h2>Recommended Peers</h2><Link to="/browse">DIRECTORY_VIEW</Link></div>
          {loading ? <div className="foundry-empty">CALIBRATING_MATCH_ENGINE…</div> : <div className="foundry-peer-list">{matches.slice(0, 4).map((match) => <Link to={`/profile/${match.id || match._id}`} key={match.id || match._id} className="foundry-peer-row"><span className="foundry-peer-avatar">{initials(match.name)}</span><span className="foundry-peer-copy"><strong>{match.name}</strong><small>{match.matchedSkills?.join(', ') || 'Promising skill overlap'}</small></span><span className="foundry-match-code">MATCH_{matchPercent(match.score)}</span></Link>)}</div>}
          {!loading && matches.length === 0 && <div className="foundry-empty">NO_SIGNALS · <Link to="/edit-skills">CONFIGURE_PROFILE</Link></div>}
        </section>

        <aside className="foundry-card col-4 foundry-tasks">
          <div className="foundry-card-heading"><h2>System Tasks</h2><span>{profileScore}%</span></div>
          <div className="foundry-task"><Icon name="spark" size={15}/><div><strong>Optimize Signal</strong><p>Complete your identity data to improve match quality.</p></div></div>
          <div className="foundry-progress"><i style={{ width: `${profileScore}%` }}/></div>
          <Link to="/edit-skills" className="primary-button">Configure Profile</Link>
        </aside>
      </div>
    </AppShell>
  );
}

export default Dashboard;
