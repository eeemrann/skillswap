import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
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
    <AppShell eyebrow="Workspace Overview" title={`Welcome, ${user?.name?.split(' ')[0] || 'Expert'}.`} description="Your expertise exchange, distilled into one focused view.">
      <div className="glass-bento-container">
        <article className="glass-card col-4"><span className="glass-kicker">Wallet</span><div className="kpi-value-glass">{user?.creditBalance ?? 0}</div><p className="glass-muted">Available hours for learning</p></article>
        <article className="glass-card col-4"><span className="glass-kicker">Recommendations</span><div className="kpi-value-glass">{loading ? '—' : matches.length}</div><p className="glass-muted">Experts found for your skills</p></article>
        <article className="glass-card col-4"><span className="glass-kicker">History</span><div className="kpi-value-glass">{loading ? '—' : completed}</div><p className="glass-muted">Completed exchanges</p></article>

        <section className="glass-card col-8">
          <div className="glass-card-heading"><h2>People worth meeting</h2><Link to="/browse">View All →</Link></div>
          {loading ? <div className="glass-empty">Finding your strongest skill overlaps…</div> : <div className="glass-expert-list">
            {matches.slice(0, 3).map((match) => <Link to={`/profile/${match.id || match._id}`} key={match.id || match._id} className="glass-expert-row"><span className="glass-expert-avatar">{initials(match.name)}</span><span className="glass-expert-copy"><strong>{match.name}</strong><small>{match.matchedSkills?.join(', ') || 'Promising skill overlap'}</small></span><span className="glass-match-pill">{matchPercent(match.score)}% Match</span></Link>)}
          </div>}
          {!loading && matches.length === 0 && <div className="glass-empty">Add learning goals to unlock expert recommendations. <Link to="/edit-skills">Complete your profile</Link></div>}
        </section>

        <aside className="glass-card col-4 glass-profile-strength">
          <div className="glass-card-heading"><h2>Profile Strength</h2><strong>{profileScore}%</strong></div>
          <div className="progress-bar-glass"><div className="progress-fill-glass" style={{ width: `${profileScore}%` }} /></div>
          <p className="glass-muted">Add a specific bio, expertise, learning goals, and location to increase match quality.</p>
          <Link to="/edit-skills" className="secondary-button glass-profile-link">Optimize Profile</Link>
        </aside>
      </div>
    </AppShell>
  );
}

export default Dashboard;
