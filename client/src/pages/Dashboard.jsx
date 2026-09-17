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

  useEffect(() => {
    const refreshUser = async () => {
      try {
        const res = await api.get('/users/me');

        dispatch(setCredentials({
          user: res.data,
          token
        }));

      } catch (err) {
        console.log(err);
      }
    };

    refreshUser();
  }, []);

  useEffect(() => {
  api.get('/matches')
    .then((res) => setMatches(res.data))
    .catch(() => {});
}, []);

  return (
    <div style={{ maxWidth: 600, margin: '50px auto' }}>
      <h2>Welcome, {user?.name}!</h2>

      <p>
        Your credit balance: {user?.creditBalance ?? '—'}
      </p>

      <h4>Recommended Matches</h4>

{matches.length === 0 && (
  <p>No matches yet — set your "skills wanted" and check back.</p>
)}

{matches.map((m) => (
  <p key={m.id}>
    {m.name} — matches on: {m.matchedSkills.join(', ')}
    (score: {m.score})
  </p>
))}

      <p>
        <Link to="/edit-skills">Edit My Skills</Link>
      </p>

      <p>
        <Link to="/browse">Browse Skills</Link>
      </p>

      <p>
        <Link to="/bookings">My Bookings</Link>
      </p>

      <button onClick={() => dispatch(logout())}>
        Logout
      </button>
    </div>
  );
}

export default Dashboard;