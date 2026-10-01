import { useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import { errorMessage, formatCredits, formatDate, formatMoney, idOf } from '../lib/format';
import { useDebounced, useQuery } from '../lib/hooks';
import { useToast } from '../lib/toast';

function Metric({ label, value, hint, icon, tone = '' }) {
  return (
    <div className={`card card-pad kpi ${tone}`}>
      <span className="kpi-icon"><Icon name={icon} size={20} /></span>
      <div className="stack" style={{ '--gap': '2px' }}>
        <span className="small muted">{label}</span>
        <strong className="kpi-value nums">{value}</strong>
        {hint && <span className="tiny faint">{hint}</span>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const me = idOf(useSelector((state) => state.auth.user));
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [busyId, setBusyId] = useState('');
  const [grant, setGrant] = useState(null);
  const [amount, setAmount] = useState('1');
  const [reason, setReason] = useState('');

  const stats = useQuery(() => api.get('/admin/stats').then((r) => r.data), [], { interval: 30000 });
  const users = useQuery(() => api.get('/admin/users', { params: { q, limit: 50 } }).then((r) => r.data), [q], { interval: 30000 });
  const payments = useQuery(() => api.get('/admin/payments').then((r) => r.data), [], { interval: 60000 });
  const s = stats.data;
  const money = (cents) => formatMoney(cents || 0, 'usd');

  const setStatus = async (user, status) => {
    setBusyId(user._id);
    try { await api.patch(`/admin/users/${user._id}/status`, { status }); toast.success(`${user.name} ${status === 'suspended' ? 'suspended' : 'restored'}`); users.reload(); stats.reload(); } catch (error) { toast.error(errorMessage(error, 'Update failed.')); } finally { setBusyId(''); }
  };

  const giveCredits = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/admin/users/${grant._id}/credits`, { amount: Number(amount), reason });
      toast.success(`Added ${amount} credits to ${grant.name}`);
      setGrant(null); setAmount('1'); setReason('');
      users.reload();
    } catch (error) { toast.error(errorMessage(error, 'Could not add credits.')); }
  };

  return (
    <AppShell eyebrow="Admin" title="Business overview" description="Revenue, growth and member management." wide>
      <div className="stack" style={{ '--gap': '28px' }}>
        {stats.error && !s && <p className="alert error" role="alert">{errorMessage(stats.error, 'Admin data could not be loaded.')}</p>}
        <div className="grid cols-4">
          <Metric label="Monthly recurring revenue" value={s ? money(s.mrrCents) : '–'} hint={s ? `${s.proUsers} Pro subscribers` : ''} icon="trending" tone="credit" />
          <Metric label="Revenue, last 30 days" value={s ? money(s.revenue30dCents) : '–'} hint={s ? `${money(s.revenueTotalCents)} all time` : ''} icon="card" />
          <Metric label="Members" value={s?.users ?? '–'} hint={s ? `${s.newUsers30d} new in 30 days · ${s.activeUsers} active` : ''} icon="users" />
          <Metric label="Sessions this week" value={s?.sessionsThisWeek ?? '–'} hint={s ? `${s.upcomingSessions} upcoming · ${s.completedBookings} completed overall` : ''} icon="video" />
        </div>
        <div className="grid cols-4">
          <Metric label="Pending requests" value={s?.pendingBookings ?? '–'} icon="clock" />
          <Metric label="Reviews" value={s?.reviews ?? '–'} icon="star" />
          <Metric label="Service fees collected" value={s ? `${formatCredits(s.feeCreditsCollected)} cr` : '–'} hint="Credits retained from Free-plan teachers" icon="wallet" />
          <Metric label="Pro conversion" value={s && s.users ? `${((s.proUsers / s.users) * 100).toFixed(1)}%` : '–'} icon="crown" />
        </div>

        <section className="card">
          <header className="card-head" style={{ padding: '20px 22px 0' }}>
            <h2 className="card-title">Members</h2>
            <div className="input-icon" style={{ width: 260, maxWidth: '100%' }}><Icon name="search" size={16} /><input className="input" type="search" placeholder="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search members" /></div>
          </header>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Member</th><th>Plan</th><th className="num">Credits</th><th>Joined</th><th>Status</th><th /></tr></thead>
            <tbody>
              {users.loading && <tr><td colSpan={6}><div className="skeleton" style={{ height: 40 }} /></td></tr>}
              {(users.data || []).map((user) => (
                <tr key={user._id}>
                  <td><div className="row nowrap"><Avatar name={user.name} src={user.profilePicture} size="sm" /><div className="stack" style={{ '--gap': '0px', minWidth: 0 }}><strong className="truncate">{user.name}</strong><span className="tiny faint truncate">{user.email}</span></div></div></td>
                  <td>{user.plan === 'pro' ? <span className="badge pro">Pro</span> : <span className="badge">Free</span>}{user.role === 'admin' && <span className="badge brand" style={{ marginLeft: 6 }}>Admin</span>}</td>
                  <td className="num">{formatCredits(user.creditBalance)}{user.creditsHeld > 0 && <span className="tiny faint"> ({formatCredits(user.creditsHeld)} held)</span>}</td>
                  <td className="nowrap-cell">{formatDate(user.createdAt)}</td>
                  <td><span className={`badge ${user.status === 'active' ? 'success' : 'danger'}`}>{user.status}</span></td>
                  <td className="num"><div className="row nowrap" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGrant(user)}>Add credits</button>
                    {user._id !== me && <button type="button" className={`btn btn-sm ${user.status === 'active' ? 'btn-danger' : 'btn-secondary'}`} disabled={busyId === user._id} onClick={() => setStatus(user, user.status === 'active' ? 'suspended' : 'active')}>{user.status === 'active' ? 'Suspend' : 'Restore'}</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </section>

        <section className="card">
          <header className="card-head" style={{ padding: '20px 22px 0' }}><h2 className="card-title">Recent payments</h2></header>
          {payments.data?.length ? (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Date</th><th>Member</th><th>Item</th><th className="num">Amount</th></tr></thead>
              <tbody>{payments.data.slice(0, 25).map((payment) => (
                <tr key={payment._id}><td className="nowrap-cell">{formatDate(payment.createdAt)}</td><td>{payment.user?.name || 'Deleted member'}</td><td className="muted">{payment.description || payment.kind}</td><td className="num">{formatMoney(payment.amountCents, payment.currency)}</td></tr>
              ))}</tbody>
            </table></div>
          ) : <p className="muted small" style={{ padding: 22 }}>No payments yet.</p>}
        </section>
      </div>

      <Modal open={Boolean(grant)} onClose={() => setGrant(null)} title="Add support credits" description={grant ? `Credits for ${grant.name}. This is recorded in the ledger.` : ''}>
        <form className="stack" style={{ '--gap': '14px' }} onSubmit={giveCredits}>
          <div className="field"><label htmlFor="g-amount">Credits (max 100)</label><input id="g-amount" className="input" type="number" min="0.5" max="100" step="0.5" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div>
          <div className="field"><label htmlFor="g-reason">Reason</label><input id="g-reason" className="input" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={150} required placeholder="e.g. Teacher no-show compensation" /></div>
          <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn btn-ghost" onClick={() => setGrant(null)}>Cancel</button><button type="submit" className="btn btn-primary">Add credits</button></div>
        </form>
      </Modal>
    </AppShell>
  );
}
