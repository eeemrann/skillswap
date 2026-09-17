import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { logout, setCredentials } from '../redux/authSlice';
import { Link } from 'react-router-dom';
import api from '../api/axios';

function Dashboard() {
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const dispatch = useDispatch();

  const [matches, setMatches] = useState([]);
  const [matchError, setMatchError] = useState('');

  // Refresh user data every time Dashboard loads
  // Keeps credit balance updated after completed bookings
  useEffect(() => {
    const refreshUser = async () => {
      try {
        const res = await api.get('/users/me');

        dispatch(
          setCredentials({
            user: res.data,
            token
          })
        );
      } catch (err) {
        console.log('Failed to refresh user:', err.message);
      }
    };

    if (token) {
      refreshUser();
    }
  }, [dispatch, token]);


  // Load recommended matches
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

    if (token) {
      fetchMatches();
    }
  }, [token]);


  return (
    <div style={{ maxWidth: 600, margin: '50px auto' }}>

      <h2>
        Welcome, {user?.name}!
      </h2>

      <p>
        Your credit balance: {user?.creditBalance ?? '—'}
      </p>


      <h4>
        Recommended Matches
      </h4>


      {matchError && (
        <p style={{ color: 'orange' }}>
          {matchError}
        </p>
      )}


      {!matchError && matches.length === 0 && (
        <p>
          No matches yet — set your "skills wanted" and check back.
        </p>
      )}


      {matches.map((m) => (
        <p key={m.id || m._id}>
          {m.name} — matches on:
          {' '}
          {m.matchedSkills?.join(', ')}
          {' '}
          (score: {m.score})
        </p>
      ))}


      <p>
        <Link to="/edit-skills">
          Edit My Skills
        </Link>
      </p>


      <p>
        <Link to="/browse">
          Browse Skills
        </Link>
      </p>


      <p>
        <Link to="/bookings">
          My Bookings
        </Link>
      </p>


      <button onClick={() => dispatch(logout())}>
        Logout
      </button>

    </div>
  );
}

export default Dashboard;