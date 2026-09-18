import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setCredentials } from '../redux/authSlice';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';

const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

function Dashboard() {
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const dispatch = useDispatch();
  const [matches, setMatches] = useState([]);
  const [matchError, setMatchError] = useState('');

  useEffect(() => {
    const refreshUser = async () => {
      try {
        const res = await api.get('/users/me');
        dispatch(setCredentials({ user: res.data, token }));
      } catch (err) {
        console.log('Failed to refresh user:', err.message);
      }
    };
    if (token) refreshUser();
  }, [dispatch, token]);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const res = await api.get('/matches');
        setMatches(res.data);
        setMatchError('');
      } catch (err) {
        console.error('Matching fetch failed:', err.message);
        setMatchError('Matching service is temporarily unavailable');
      }
    };
    if (token) fetchMatches();
  }, [token]);

  return (
    <AppShell eyebrow="Your workspace" title={`Good to see you, ${user?.name?.split(' ')[0] || 'there'}.`} description="A quick look at your learning momentum and the people you could grow with next." action={<Link className="primary-button" to="/browse">Discover a skill <span>→</span></Link>}>
      <div className="content-grid" style={{ gap: 28 }}>
        <div className="stat-row">
          <div className="stat-card"><small>Available credits</small><strong>{user?.creditBalance ?? '—'} <em>hrs</em></strong></div>
          <div className="stat-card"><small>Recommended matches</small><strong>{matches.length}</strong></div>
          <div className="stat-card"><small>Profile status</small><strong>{user?.skillsOffered?.length ? 'Live' : 'Start'}</strong></div>
        </div>
        <div className="content-grid two-column">
          <section className="surface surface-pad">
            <div className="dashboard-welcome"><span className="avatar">{initials(user?.name)}</span><div><p className="section-kicker" style={{ marginBottom: 4 }}>Your next best connection</p><h2 style={{ margin: 0, fontSize: 22 }}>People who fit your curiosity</h2></div></div>
            <div style={{ marginTop: 24 }}>
              {matchError && <p className="status-message error">{matchError}</p>}
              {!matchError && matches.length === 0 && <div className="empty-state"><strong>Your recommendations are warming up</strong>Complete your skill profile to unlock more relevant matches.</div>}
              <div className="match-list">{matches.map((match) => <div className="match-card" key={match.id || match._id}><div><h3>{match.name}</h3><p>Shared interests: {match.matchedSkills?.join(', ') || 'A promising overlap'}</p></div><span className="match-score">{match.score} match</span></div>)}</div>
            </div>
          </section>
          <aside className="surface surface-pad profile-card"><p className="section-kicker">Your exchange profile</p><h2>{user?.name || 'Your profile'}</h2><p>{user?.skillsOffered?.length ? 'You are ready to share what you know.' : 'Add a few skills so the right people can find you.'}</p><div className="credit-balance"><small>Time credit balance</small><strong>{user?.creditBalance ?? 0} <span>hours</span></strong></div><Link className="secondary-button" to="/edit-skills">Edit skill profile <span>→</span></Link></aside>
        </div>
      </div>
    </AppShell>
  );
}

export default Dashboard;
