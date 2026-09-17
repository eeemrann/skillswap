import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../redux/authSlice';

function Dashboard() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();

  return (
    <div style={{ maxWidth: 600, margin: '50px auto' }}>
      <h2>Welcome, {user?.name}!</h2>
      <p>Your credit balance: {user?.creditBalance ?? '—'}</p>
      <button onClick={() => dispatch(logout())}>Logout</button>
    </div>
  );
}

export default Dashboard;