import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import AppShell from '../components/AppShell';
import api from '../api/axios';
import Icon from '../components/Icon';

const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState('');
  const currentUser = useSelector((state) => state.auth.user);
  const currentUserId = currentUser?.id || currentUser?._id;

  const loadData = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const [statsResult, usersResult] = await Promise.all([api.get('/admin/stats'), api.get('/admin/users')]);
      setStats(statsResult.data);
      setUsers(usersResult.data);
      setMessage('');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Access denied: administrative credentials required.');
    } finally { if (initial) setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => active && loadData(true));
    const refresh = () => { if (!document.hidden && active) loadData(false); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [loadData]);

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    setMessage('');
    try {
      await api.patch(`/admin/users/${id}/status`, { status });
      setMessage(`Member access ${status === 'active' ? 'restored' : 'suspended'}.`);
      await loadData();
    } catch (error) {
      setMessage(error.response?.data?.message || 'User status could not be updated.');
    } finally { setUpdatingId(''); }
  };

  const metrics = [
    { key: 'users', label: 'Total Base', detail: 'Registered', icon: 'users' },
    { key: 'activeUsers', label: 'Active Now', detail: 'Healthy access', icon: 'spark' },
    { key: 'completedBookings', label: 'Swaps', detail: 'Completed', icon: 'calendar' },
    { key: 'pendingBookings', label: 'Requests', detail: 'Open queue', icon: 'message' },
    { key: 'transactions', label: 'Ledger Vol', detail: 'Movements', icon: 'wallet' },
    { key: 'reviews', label: 'Signals', detail: 'Reviews', icon: 'spark' }
  ];

  const visibleUsers = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return users;
    return users.filter((user) => `${user.name} ${user.email} ${user.role} ${user.status}`.toLowerCase().includes(search));
  }, [query, users]);
  const messageIsError = /denied|could not|failed|invalid|required/i.test(message);

  return (
    <AppShell eyebrow="Operations" title="Command Center" description="Total oversight of exchange health, platform momentum, and member access.">
      <div className="page-enter">
        {message && <div className={`admin-alert ${messageIsError ? 'error' : 'success'}`} role="status"><span>{messageIsError ? '!' : '✓'}</span>{message}</div>}

        <section className="admin-grid" aria-label="Platform metrics">
          {metrics.map((metric) => <article key={metric.key} className="admin-metric-card"><div className="admin-metric-head"><span>{metric.label}</span><Icon name={metric.icon} size={15}/></div><strong>{loading ? '—' : stats?.[metric.key] ?? '—'}</strong><small>{metric.detail}</small></article>)}
        </section>

        <section className="glass-card admin-command-table">
          <header className="admin-command-header"><div><h2>Member Directory</h2><p>Identity, access state, role, and governance controls.</p></div><div className="admin-command-tools"><label><Icon name="search" size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search members…" aria-label="Search members"/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">&times;</button>}</label><span>{visibleUsers.length} of {users.length}</span></div></header>

          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Member</th><th>Status</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{visibleUsers.map((user) => {
            const isSelf = String(user._id) === String(currentUserId);
            const isUpdating = updatingId === user._id;
            return <tr key={user._id}><td data-label="Member"><div className="admin-member-precision"><span className="ledger-avatar">{initials(user.name)}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div></td><td data-label="Status"><span className={`status-badge-glass ${user.status === 'active' ? 'accepted' : 'declined'}`}>{user.status}</span></td><td data-label="Role"><span className={`admin-role ${user.role}`}>{user.role}</span></td><td data-label="Joined"><time>{user.createdAt ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</time></td><td data-label="Actions">{isSelf ? <span className="system-admin"><Icon name="settings" size={12}/> Current Admin</span> : <button type="button" className={user.status === 'active' ? 'btn-action-suspend' : 'btn-action-restore'} disabled={isUpdating} onClick={() => updateStatus(user._id, user.status === 'active' ? 'suspended' : 'active')}>{isUpdating ? 'Updating…' : user.status === 'active' ? 'Suspend Access' : 'Restore Account'}</button>}</td></tr>;
          })}</tbody></table></div>

          {loading && <div className="admin-loading">Loading command center…</div>}
          {!loading && visibleUsers.length === 0 && <div className="admin-empty"><Icon name="users" size={22}/><strong>No members found</strong><span>Try a different search.</span></div>}
        </section>
      </div>
    </AppShell>
  );
}

export default AdminDashboard;
