import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import AppShell from '../components/AppShell';
import api from '../api/axios';
import Icon from '../components/Icon';

const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SS';
const entityId = (entity) => typeof entity === 'string' ? entity : entity?._id;

function CreditHistory() {
  const currentUser = useSelector((state) => state.auth.user);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/credits/history').then(({ data }) => active && setTransactions(data))
      .catch((requestError) => active && setError(requestError.response?.data?.message || 'Could not load your credit history.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const ownId = currentUser?._id || currentUser?.id;
  const totals = useMemo(() => transactions.reduce((result, transaction) => {
    const amount = Number(transaction.amount) || 0;
    if (entityId(transaction.to) === ownId) result.earned += amount;
    if (entityId(transaction.from) === ownId) result.spent += amount;
    return result;
  }, { earned: 0, spent: 0 }), [ownId, transactions]);

  return (
    <AppShell eyebrow="VERIFIED_TRANSACTIONS" title="Immutable Ledger" description="A precise statement of knowledge wealth and learning investment.">
      <div className="page-enter">
        <div className="foundry-grid-12 ledger-kpi-grid">
          <article className="foundry-card col-4"><span className="mono-label">Current Balance</span><div className="mono-value">{currentUser?.creditBalance ?? 0} <small>HRS</small></div><p className="glass-muted">Ready for your next learning session</p></article>
          <article className="foundry-card col-4"><span className="mono-label ledger-earned-label">Lifetime Earned</span><div className="mono-value ledger-earned-value">+{totals.earned}</div><p className="glass-muted">Total expertise shared with the community</p></article>
          <article className="foundry-card col-4"><span className="mono-label">Learning Investment</span><div className="mono-value">{totals.spent}</div><p className="glass-muted">Credits utilized for self-growth</p></article>
        </div>

        {error && <p className="status-message error" role="alert">{error}</p>}

        <section className="foundry-card ledger-statement foundry-ledger">
          <header className="ledger-statement-header"><div><h2>Transaction History</h2><p>A complete record of your time-credit movement.</p></div><span>{transactions.length} {transactions.length === 1 ? 'Transaction' : 'Transactions'}</span></header>
          <div className="ledger-column-head" aria-hidden="true"><span>Counterparty</span><span>Movement</span><span>Date</span><span>Amount</span></div>
          <div className="ledger-rows">
            {transactions.map((transaction) => {
              const isEarning = entityId(transaction.to) === ownId;
              const partner = isEarning ? transaction.from : transaction.to;
              const partnerName = partner?.name || 'Community Member';
              const amount = Number(transaction.amount) || 0;
              const date = new Date(transaction.createdAt);
              return <div key={transaction._id} className="ledger-row"><div className="ledger-avatar">{initials(partnerName)}</div><div className="ledger-row-copy"><strong>{isEarning ? 'Knowledge Share' : 'Skill Acquisition'}</strong><span>{isEarning ? 'From' : 'To'} {partnerName}</span></div><time>{date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</time><div className={`amount-pill ${isEarning ? 'inflow' : 'outflow'}`}>{isEarning ? '+' : '−'}{amount.toFixed(1)}</div></div>;
            })}
            {loading && <div className="ledger-loading">Loading your financial statement…</div>}
            {!loading && transactions.length === 0 && !error && <div className="ledger-empty"><Icon name="wallet" size={32}/><strong>Your ledger is empty</strong><span>Complete an exchange to record your first credit movement.</span></div>}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default CreditHistory;
