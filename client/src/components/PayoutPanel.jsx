import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { openPayoutDashboard, startPayoutSetup } from '../lib/billing';
import { creditsLabel, errorMessage, formatCredits, formatDate, formatMoney } from '../lib/format';
import { useQuery } from '../lib/hooks';
import { useToast } from '../lib/toast';
import { updateUser } from '../redux/authSlice';
import EmptyState from './EmptyState';
import Icon from './Icon';

const PAYOUT_STATUS = {
  paid: { label: 'Paid', tone: 'success' },
  processing: { label: 'Processing', tone: 'warning' },
  pending_review: { label: 'In review', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
  rejected: { label: 'Declined', tone: 'danger' }
};

/** Teacher earnings: what can be cashed out now, what is still clearing, payout account status and history. */
export default function PayoutPanel() {
  const dispatch = useDispatch();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const summary = useQuery(() => api.get('/payouts/summary').then((r) => r.data), [], { interval: 60000 });
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState('');
  const s = summary.data;

  // Back from Stripe's onboarding: re-read the account status. If the link expired, send them back in.
  const connectParam = params.get('connect');
  useEffect(() => {
    if (!connectParam) return;
    setParams((current) => { const next = new URLSearchParams(current); next.delete('connect'); return next; }, { replace: true });
    if (connectParam === 'refresh') { startPayoutSetup().catch((error) => toast.error(errorMessage(error, 'Payout setup is unavailable right now.'))); return; }
    toast.info('Checking your payout account…');
    summary.reload();
    api.get('/users/me').then((r) => dispatch(updateUser(r.data))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectParam]);

  if (summary.loading) return <div className="skeleton" style={{ height: 220 }} />;
  if (summary.error && !s) return <p className="alert error" role="alert">Your earnings could not be loaded. <button type="button" className="btn btn-sm btn-secondary" onClick={summary.reload}>Retry</button></p>;
  if (!s) return null;

  const money = (cents) => formatMoney(cents, s.currency);
  const parsed = Number(amount);
  const cents = Number.isFinite(parsed) ? Math.round(parsed * s.rateCentsPerCredit) : 0;
  const ready = s.connect.status === 'ready';
  const canSubmit = ready && !s.blocked && parsed > 0 && parsed <= s.withdrawableCredits + 1e-9 && cents >= s.minPayoutCents;

  const run = async (key, task, failure) => {
    setBusy(key);
    try { await task(); } catch (error) { toast.error(errorMessage(error, failure)); } finally { setBusy(''); }
  };

  const withdraw = async (event) => {
    event.preventDefault();
    setBusy('withdraw');
    try {
      const { data } = await api.post('/payouts', { credits: parsed });
      if (data.status === 'paid') toast.success(`${money(data.amountCents)} is on its way to your bank.`);
      else if (data.status === 'pending_review') toast.info('Your withdrawal is waiting for a quick review. We will email you.');
      else if (data.status === 'processing') toast.info('Your withdrawal is being processed.');
      else toast.error('The transfer could not be completed. Your credits are back in your wallet.');
      setAmount('');
      summary.reload();
      api.get('/users/me').then((r) => dispatch(updateUser(r.data))).catch(() => {});
    } catch (error) {
      toast.error(errorMessage(error, 'Your withdrawal could not be started.'));
      summary.reload();
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="card card-pad stack" style={{ '--gap': '20px' }}>
      <header className="row spread">
        <div className="stack" style={{ '--gap': '2px' }}>
          <h2 className="card-title">Earnings & withdrawals</h2>
          <p className="small muted">Credits you earn by teaching can be cashed out. Credits you buy or receive as a welcome gift are for learning only.</p>
        </div>
        {ready && <span className="verified-badge"><Icon name="checkCircle" size={14} /> Payouts ready</span>}
      </header>

      <div className="grid cols-3" style={{ '--gap': '12px' }}>
        <div className="cost-box"><span className="small muted">Ready to withdraw</span><strong className="stat-value nums">{money(s.withdrawableCents)}</strong><span className="tiny faint">{creditsLabel(s.withdrawableCredits)}</span></div>
        <div className="cost-box"><span className="small muted">Still clearing</span><strong className="stat-value nums">{formatCredits(s.pendingCredits)}</strong><span className="tiny faint">Earnings can be withdrawn {s.holdDays} days after a session settles</span></div>
        <div className="cost-box"><span className="small muted">Cash-out rate</span><strong className="stat-value nums">{money(s.rateCentsPerCredit)}</strong><span className="tiny faint">per credit · minimum {money(s.minPayoutCents)}</span></div>
      </div>

      {s.blocked && <p className="alert error" role="alert"><Icon name="alert" /> {s.blockedReason}</p>}
      {!s.enabled && <p className="alert warning"><Icon name="info" /> Withdrawals are not enabled on this deployment yet.</p>}

      {s.enabled && !ready && (
        <div className="upsell row spread nowrap" style={{ alignItems: 'center' }}>
          <div className="stack" style={{ '--gap': '3px' }}>
            <strong>{s.connect.status === 'incomplete' ? 'Finish setting up payouts' : 'Set up payouts to cash out'}</strong>
            <span className="small muted">Stripe verifies your identity and bank account once, securely. SkillSwap never sees your bank details. Takes about five minutes.</span>
          </div>
          <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => run('connect', startPayoutSetup, 'Payout setup is unavailable right now.')}>{busy === 'connect' ? <span className="spinner" /> : <><Icon name="external" size={15} /> {s.connect.status === 'incomplete' ? 'Continue setup' : 'Set up payouts'}</>}</button>
        </div>
      )}

      {ready && (
        <form className="stack" style={{ '--gap': '12px' }} onSubmit={withdraw}>
          <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
            <div className="field" style={{ flex: '1 1 220px', maxWidth: 320 }}>
              <label htmlFor="wd-amount">Credits to withdraw</label>
              <div className="row nowrap" style={{ gap: 8 }}>
                <input id="wd-amount" className="input" type="number" inputMode="decimal" min="0" step="0.25" max={s.withdrawableCredits} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={`Up to ${formatCredits(s.withdrawableCredits)}`} disabled={s.blocked || s.withdrawableCredits <= 0} />
                <button type="button" className="btn btn-secondary" disabled={s.withdrawableCredits <= 0 || s.blocked} onClick={() => setAmount(String(s.withdrawableCredits))}>Max</button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit || Boolean(busy)}>{busy === 'withdraw' ? <span className="spinner" /> : cents > 0 ? `Withdraw ${money(cents)}` : 'Withdraw'}</button>
            <button type="button" className="btn btn-ghost" disabled={Boolean(busy)} onClick={() => run('dashboard', openPayoutDashboard, 'The Stripe dashboard is unavailable right now.')}><Icon name="external" size={15} /> Stripe dashboard</button>
          </div>
          <span className="hint">
            {s.withdrawableCredits <= 0 ? 'Nothing to withdraw yet. Earnings from finished sessions become available after the clearing period.'
              : parsed > 0 && cents < s.minPayoutCents ? `The minimum withdrawal is ${money(s.minPayoutCents)} (${formatCredits(s.minPayoutCredits)} credits).`
                : `You will receive ${money(cents)} · transfers usually arrive within a few business days.`}
          </span>
          {s.firstPayoutReview && <span className="hint">Your first withdrawal is checked by our team before it is sent, usually within one business day. After that, most withdrawals are sent automatically.</span>}
        </form>
      )}

      <div className="stack" style={{ '--gap': '8px' }}>
        <h3 className="card-title" style={{ fontSize: 14 }}>Withdrawal history</h3>
        {s.payouts.length === 0 ? <EmptyState icon="wallet" title="No withdrawals yet">Your first payout will appear here.</EmptyState> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Date</th><th>Status</th><th className="num">Credits</th><th className="num">Amount</th></tr></thead>
            <tbody>{s.payouts.map((payout) => {
              const meta = PAYOUT_STATUS[payout.status] || { label: payout.status, tone: '' };
              return (
                <tr key={payout._id}>
                  <td className="nowrap-cell">{formatDate(payout.createdAt)}</td>
                  <td><span className={`badge ${meta.tone}`}>{meta.label}</span>{['failed', 'rejected'].includes(payout.status) && payout.failureReason && <span className="tiny faint" style={{ display: 'block', marginTop: 4 }}>{payout.failureReason}</span>}</td>
                  <td className="num">{formatCredits(payout.credits)}</td>
                  <td className="num">{money(payout.amountCents)}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>
    </section>
  );
}
