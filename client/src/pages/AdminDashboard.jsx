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

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const [statsResult, usersResult] = await Promise.all([api.get('/admin/stats'), api.get('/admin/users')]);
      setStats(statsResult.data); setUsers(usersResult.data); setMessage('');
    } catch (err) { setMessage(err.response?.data?.message || 'Admin data could not be loaded.'); }
    finally { if (initial) setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => active && load(true));
    const refresh = () => { if (!document.hidden && active) load(false); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);

  const updateStatus = async (id, status) => {
    setUpdatingId(id); setMessage('');
    try {
      await api.patch(`/admin/users/${id}/status`, { status });
      setMessage(`Member access ${status === 'active' ? 'restored' : 'suspended'}.`);
      await load();
    } catch (err) { setMessage(err.response?.data?.message || 'User status could not be updated.'); }
    finally { setUpdatingId(''); }
  };

  const metrics = [
    { key: 'users', label: 'Total base', detail: 'Registered members', icon: 'users' },
    { key: 'activeUsers', label: 'Active access', detail: 'Healthy accounts', icon: 'spark' },
    { key: 'completedBookings', label: 'Completed swaps', detail: 'Successful exchanges', icon: 'calendar' },
    { key: 'pendingBookings', label: 'Open requests', detail: 'Awaiting a response', icon: 'message' },
    { key: 'transactions', label: 'Credit volume', detail: 'Ledger movements', icon: 'wallet' },
    { key: 'reviews', label: 'Reviews', detail: 'Community signals', icon: 'spark' }
  ];
  const visibleUsers = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return users;
    return users.filter((user) => `${user.name} ${user.email} ${user.role} ${user.status}`.toLowerCase().includes(search));
  }, [query, users]);

  return <AppShell eyebrow="Control tower" title="Platform operations" description="Monitor exchange health, member access, and platform momentum.">
    {message && <p className={`admin-alert ${/could not|failed|invalid/i.test(message) ? 'error' : 'success'}`} role="status"><span>{/could not|failed|invalid/i.test(message) ? '!' : '✓'}</span>{message}</p>}
    <section className="admin-metrics" aria-label="Platform metrics">{metrics.map((metric) => <article className="admin-metric" key={metric.key}><div><span>{metric.label}</span><strong>{loading ? '—' : stats?.[metric.key] ?? '—'}</strong><small>{metric.detail}</small></div><i><Icon name={metric.icon} size={18}/></i></article>)}</section>

    <section className="admin-directory">
      <header className="admin-directory-header"><div><h2>Member directory</h2><p>Review identity, access state, and administrative roles.</p></div><div className="admin-directory-tools"><label><Icon name="search" size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search members…" aria-label="Search members"/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">&times;</button>}</label><span>{visibleUsers.length} of {users.length}</span></div></header>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Member</th><th>Status</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{visibleUsers.map((user) => { const isSelf = String(user._id) === String(currentUserId); return <tr key={user._id}><td data-label="Member"><div className="admin-member"><span>{initials(user.name)}</span><div><strong>{user.name}</strong><small>{user.email}</small></div></div></td><td data-label="Status"><span className={`badge-premium ${user.status === 'active' ? 'accepted' : 'declined'}`}><i/>{user.status}</span></td><td data-label="Role"><span className={`admin-role ${user.role}`}>{user.role}</span></td><td data-label="Joined"><time>{user.createdAt ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</time></td><td data-label="Actions">{isSelf ? <span className="system-admin"><Icon name="settings" size={12}/> System admin</span> : <button type="button" className={user.status === 'active' ? 'admin-suspend' : 'admin-restore'} disabled={updatingId === user._id} onClick={() => updateStatus(user._id, user.status === 'active' ? 'suspended' : 'active')}>{updatingId === user._id ? 'Updating…' : user.status === 'active' ? 'Suspend access' : 'Restore access'}</button>}</td></tr>; })}</tbody></table></div>
      {!loading && visibleUsers.length === 0 && <div className="admin-empty"><Icon name="users" size={22}/><strong>No members found</strong><span>Try a different search.</span></div>}
      {loading && <div className="admin-loading">Loading command center…</div>}
    </section>
  </AppShell>;
}

export default AdminDashboard;
