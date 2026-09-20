import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';
import api from '../api/axios';

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([api.get('/admin/stats'), api.get('/admin/users')]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Admin data could not be loaded.');
    }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/users/${id}/status`, { status });
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || 'User status could not be updated.');
    }
  };

  const statLabels = {
    users: 'Total users',
    activeUsers: 'Active users',
    completedBookings: 'Completed swaps',
    pendingBookings: 'Pending requests',
    transactions: 'Credit transactions',
    reviews: 'Reviews left'
  };

  return (
    <AppShell eyebrow="Platform operations" title="Keep SkillSwap healthy." description="Moderate the community and watch the exchange move.">
      {message && <p className="status-message error">{message}</p>}
      <div className="stat-row">
        {Object.keys(statLabels).map((key) => (
          <div className="stat-card" key={key}>
            <small>{statLabels[key]}</small>
            <strong>{stats?.[key] ?? '—'}</strong>
          </div>
        ))}
      </div>
      <section className="surface surface-pad" style={{ marginTop: 20 }}>
        <p className="section-kicker">Community members</p>
        <div className="booking-list">
          {users.map((user) => (
            <div className="booking-card" key={user._id}>
              <div>
                <h3>{user.name}</h3>
                <div className="booking-meta">
                  <span>{user.email}</span>
                  <span>{user.role} · {user.status}</span>
                </div>
              </div>
              <div className="booking-actions">
                <button type="button" onClick={() => updateStatus(user._id, user.status === 'active' ? 'suspended' : 'active')}>
                  {user.status === 'active' ? 'Suspend' : 'Restore'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

export default AdminDashboard;