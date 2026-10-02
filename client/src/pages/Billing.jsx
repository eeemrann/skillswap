import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import PayoutPanel from '../components/PayoutPanel';
import PricingTable from '../components/PricingTable';
import { openBillingPortal } from '../lib/billing';
import { creditsLabel, errorMessage, formatCredits, formatDate, formatMoney } from '../lib/format';
import { useQuery } from '../lib/hooks';
import { useToast } from '../lib/toast';
import { updateUser } from '../redux/authSlice';

const TYPE_LABEL = { session: 'Session', purchase: 'Credit pack', subscription_grant: 'Pro credits', signup_bonus: 'Welcome bonus', adjustment: 'Adjustment', payout: 'Withdrawal', payout_refund: 'Withdrawal returned' };

function Stat({ label, value, hint, tone = '' }) {
  return (
    <div className={`card card-pad stat ${tone}`}>
      <span className="small muted">{label}</span>
      <strong className="stat-value nums">{value}</strong>
      {hint && <span className="tiny faint">{hint}</span>}
    </div>
  );
}

export default function Billing() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [portalBusy, setPortalBusy] = useState(false);
  const isPro = user?.effectivePlan === 'pro';

  const ledger = useQuery(() => api.get('/credits/history', { params: { limit: 50 } }).then((r) => r.data), []);
  const payments = useQuery(() => api.get('/billing/payments').then((r) => r.data), []);

  // Returning from Stripe Checkout: the webhook may land a moment after the redirect, so poll briefly.
  const returned = params.get('status');
  useEffect(() => {
    if (!returned) return undefined;
    setParams({}, { replace: true });
    if (returned === 'cancelled') { toast.info('Checkout cancelled. You have not been charged.'); return undefined; }
    toast.success('Payment received. Updating your wallet…');
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      try {
        const { data } = await api.get('/users/me');
        dispatch(updateUser(data));
        ledger.reload();
        payments.reload();
      } catch { /* try again on the next tick */ }
      if (attempts >= 8) window.clearInterval(timer);
    }, 2500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returned]);

  const totals = useMemo(() => (ledger.data || []).reduce((sum, entry) => {
    if (entry.direction === 'in' && entry.type === 'session') sum.earned += entry.amount;
    if (entry.direction === 'out') sum.spent += entry.amount;
    if (entry.direction === 'in' && !['session', 'payout_refund'].includes(entry.type)) sum.bought += entry.amount;
    return sum;
  }, { earned: 0, spent: 0, bought: 0 }), [ledger.data]);

  const portal = async () => {
    setPortalBusy(true);
    try { await openBillingPortal(); } catch (error) { toast.error(errorMessage(error, 'The billing portal is unavailable.')); setPortalBusy(false); }
  };

  const renewal = user?.currentPeriodEnd ? formatDate(user.currentPeriodEnd) : null;
  const earnsMoney = ['approved', 'revoked'].includes(user?.teacherStatus) || (user?.earnedCredits || 0) > 0;

  return (
    <AppShell eyebrow="Wallet & plan" title="Credits, earnings & billing" description="Credits pay for live lessons with verified tech experts. Buy them any time. Verified teachers earn them and cash out.">
      <div className="stack" style={{ '--gap': '28px' }}>
        <div className="grid cols-4">
          <Stat tone="credit" label="Spendable credits" value={formatCredits(user?.availableCredits ?? user?.creditBalance ?? 0)} hint={user?.creditsHeld > 0 ? `${creditsLabel(user.creditsHeld)} held for confirmed sessions` : 'Ready to spend'} />
          <Stat label={earnsMoney ? 'Earned, cash-out eligible' : 'Earned teaching'} value={formatCredits(earnsMoney ? user?.earnedCredits || 0 : totals.earned)} hint={earnsMoney ? 'Part of your spendable credits' : 'Last 50 entries'} />
          <Stat label="Spent learning" value={formatCredits(totals.spent)} hint="Last 50 entries" />
          <Stat label="Bought & bonus" value={formatCredits(totals.bought)} hint="Packs, Pro and welcome credits (learning only)" />
        </div>

        {earnsMoney ? <PayoutPanel /> : (
          <section className="card card-pad plan-banner">
            <div className="stack grow" style={{ '--gap': '6px' }}>
              <h2 className="card-title">Turn your expertise into income</h2>
              <p className="muted small">Lecturers, engineers and certified trainers can apply to teach. Verified teachers earn credits for every session and cash them out to their bank.</p>
            </div>
            <Link className="btn btn-primary" to="/teach"><Icon name="bolt" size={16} /> Become a verified teacher</Link>
          </section>
        )}

        <section className="card card-pad plan-banner">
          <div className="stack grow" style={{ '--gap': '6px' }}>
            <div className="row" style={{ gap: 10 }}>
              <h2 className="card-title">{isPro ? 'SkillSwap Pro' : 'Free plan'}</h2>
              {isPro && <span className={`badge ${user.planStatus === 'past_due' ? 'warning' : 'pro'}`}>{user.planStatus === 'past_due' ? 'Payment issue' : `Pro · ${user.planInterval === 'year' ? 'yearly' : 'monthly'}`}</span>}
            </div>
            {isPro ? (
              <p className="muted small">
                {user.planStatus === 'past_due' ? 'We could not charge your card. Update your payment method to keep Pro.' : user.cancelAtPeriodEnd ? `Your subscription ends on ${renewal}. You keep Pro until then.` : renewal ? `Renews on ${renewal}.` : 'Active.'}
                {' '}Reduced {user.limits?.serviceFeePct}% platform fee, up to {user.limits?.maxActiveBookings} active bookings, sessions up to {(user.limits?.maxSessionMinutes || 0) / 60} hours.
              </p>
            ) : <p className="muted small">Teachers keep {100 - (user?.limits?.serviceFeePct ?? 12)}% of what they earn, and you can have up to {user?.limits?.maxActiveBookings ?? 3} active bookings with {user?.limits?.maxSessionMinutes ?? 60}-minute sessions. Pro lowers the fee and lifts the limits.</p>}
          </div>
          {user?.hasBilling && <button type="button" className="btn btn-secondary" onClick={portal} disabled={portalBusy}>{portalBusy ? <span className="spinner" /> : <><Icon name="card" size={16} /> Manage billing</>}</button>}
        </section>

        <section className="stack" style={{ '--gap': '8px' }}>
          <div className="stack" style={{ '--gap': '4px' }}><h2 style={{ fontSize: 22 }}>{isPro ? 'Buy credits' : 'Buy credits or upgrade'}</h2><p className="muted small">Secure checkout by Stripe in your local currency where available. Credits never expire.</p></div>
          <PricingTable currentPlan={user?.effectivePlan} showPlans={!isPro} />
        </section>

        <section className="card">
          <header className="card-head" style={{ padding: '20px 22px 0' }}><div><h2 className="card-title">Credit history</h2><p className="small muted">Every credit that moved in or out of your wallet, including withdrawals.</p></div></header>
          {ledger.loading ? <div className="skeleton" style={{ height: 180, margin: 22 }} /> : !ledger.data?.length ? (
            <EmptyState icon="wallet" title="No credit activity yet" action={<Link className="btn btn-secondary" to="/browse">Book a session</Link>}>Your first session or purchase will show up here.</EmptyState>
          ) : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Date</th><th>Activity</th><th>Details</th><th className="num">Credits</th></tr></thead>
              <tbody>{ledger.data.map((entry) => (
                <tr key={entry._id}>
                  <td className="nowrap-cell">{formatDate(entry.createdAt)}</td>
                  <td><span className="badge">{entry.type === 'session' ? (entry.direction === 'in' ? 'Taught' : 'Learned') : TYPE_LABEL[entry.type] || entry.type}</span></td>
                  <td className="muted">{entry.type === 'session' ? `${entry.description}${entry.counterpart ? ` · ${entry.direction === 'in' ? 'from' : 'with'} ${entry.counterpart}` : ''}${entry.fee > 0 ? ` · ${formatCredits(entry.fee)} fee` : ''}` : entry.description}</td>
                  <td className={`num ${entry.direction === 'in' ? 'positive' : 'negative'}`}>{entry.direction === 'in' ? '+' : '−'}{formatCredits(entry.amount)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </section>

        {payments.data?.length > 0 && (
          <section className="card">
            <header className="card-head" style={{ padding: '20px 22px 0' }}><h2 className="card-title">Payments & receipts</h2></header>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Date</th><th>Description</th><th className="num">Amount</th><th /></tr></thead>
              <tbody>{payments.data.map((payment) => (
                <tr key={payment._id}>
                  <td className="nowrap-cell">{formatDate(payment.createdAt)}</td>
                  <td>{payment.description || (payment.kind === 'subscription' ? 'SkillSwap Pro' : 'Credit pack')}</td>
                  <td className="num">{formatMoney(payment.amountCents, payment.currency)}</td>
                  <td className="num">{payment.receiptUrl && <a href={payment.receiptUrl} target="_blank" rel="noreferrer">Receipt <Icon name="external" size={12} /></a>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
