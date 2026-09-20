import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { setCredentials } from '../redux/authSlice';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Icon from '../components/Icon';

const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

function Dashboard() {
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const dispatch = useDispatch();
  const [matches, setMatches] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [matchError, setMatchError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    api.get('/users/me').then((res) => { if (active) dispatch(setCredentials({ user: res.data, token })); }).catch(() => {});
    Promise.allSettled([api.get('/matches'), api.get('/bookings')]).then(([matchResult, bookingResult]) => {
      if (!active) return;
      if (matchResult.status === 'fulfilled') setMatches(matchResult.value.data);
      else setMatchError('Recommendations are temporarily unavailable.');
      if (bookingResult.status === 'fulfilled') setBookings(bookingResult.value.data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [dispatch, token]);

  const upcoming = bookings.filter((item) => ['pending', 'accepted'].includes(item.status)).slice(0, 3);
  const completed = bookings.filter((item) => item.status === 'completed').length;

  return (
    <AppShell eyebrow="Workspace overview" title={`Welcome back, ${user?.name?.split(' ')[0] || 'there'}.`} description="Everything you need to keep learning, teaching, and building momentum." action={<Link className="primary-button" to="/browse">Explore skills <Icon name="arrow" size={16}/></Link>}>
      <div className="content-grid dashboard-grid">
        <div className="stat-row">
          <div className="stat-card"><small>Available credits</small><strong>{user?.creditBalance ?? 0} <em>hours</em></strong></div>
          <div className="stat-card"><small>Recommended matches</small><strong>{loading ? '...' : matches.length}</strong></div>
          <div className="stat-card"><small>Completed exchanges</small><strong>{loading ? '...' : completed}</strong></div>
        </div>
        <div className="content-grid two-column">
          <section className="surface surface-pad">
            <div className="section-heading"><div><p className="section-kicker">Recommended for you</p><h2>People worth meeting</h2></div><Link to="/browse">View all <Icon name="arrow" size={14}/></Link></div>
            {matchError && <p className="status-message error">{matchError}</p>}
            {!matchError && !loading && matches.length === 0 && <div className="empty-state"><strong>Complete your skill profile</strong>Add what you can teach and want to learn to unlock tailored matches.</div>}
            <div className="match-list">{matches.slice(0, 4).map((match) => <article className="match-card" key={match.id || match._id}><div className="match-person"><span className="avatar avatar-small">{initials(match.name)}</span><div><h3>{match.name}</h3><p>{match.matchedSkills?.join(' · ') || 'A promising skill overlap'}</p></div></div><span className="match-score">{match.score || 'New'} match</span></article>)}</div>
          </section>
          <aside className="surface surface-pad profile-card"><p className="section-kicker">Your profile</p><span className="profile-avatar">{initials(user?.name)}</span><h2>{user?.name || 'Your profile'}</h2><p>{user?.skillsOffered?.length ? `${user.skillsOffered.length} skills ready to share with the community.` : 'Add your strengths so the right learners can find you.'}</p><div className="credit-balance"><small>Time credit balance</small><strong>{user?.creditBalance ?? 0} <span>credits</span></strong></div><Link className="secondary-button" to="/edit-skills">Improve profile <Icon name="arrow" size={15}/></Link></aside>
        </div>
        <section className="surface surface-pad">
          <div className="section-heading"><div><p className="section-kicker">Your schedule</p><h2>Upcoming exchanges</h2></div><Link to="/bookings">Manage bookings <Icon name="arrow" size={14}/></Link></div>
          {!loading && upcoming.length === 0 ? <div className="empty-state"><strong>Your calendar is open</strong>Discover a teacher and request your first session.</div> : <div className="upcoming-grid">{upcoming.map((booking) => <article className="upcoming-card" key={booking._id}><span className={`booking-status ${booking.status}`}>{booking.status}</span><h3>{booking.skill}</h3><p>{new Date(booking.proposedTime).toLocaleString()}</p></article>)}</div>}
        </section>
      </div>
    </AppShell>
  );
}
export default Dashboard;
