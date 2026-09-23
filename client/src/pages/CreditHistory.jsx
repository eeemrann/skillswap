import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import AppShell from '../components/AppShell';
import api from '../api/axios';
import Icon from '../components/Icon';

const entityId = (entity) => typeof entity === 'string' ? entity : entity?._id;

function CreditHistory() {
  const currentUser = useSelector((state) => state.auth.user);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/credits/history').then(({ data }) => active && setTransactions(data))
      .catch((err) => active && setError(err.response?.data?.message || 'Could not load your credit history.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const ownId = currentUser?._id || currentUser?.id;
  const totals = useMemo(() => transactions.reduce((result, transaction) => {
    if (entityId(transaction.to) === ownId) result.earned += transaction.amount;
    if (entityId(transaction.from) === ownId) result.spent += transaction.amount;
    return result;
  }, { earned: 0, spent: 0 }), [ownId, transactions]);

  return <AppShell eyebrow="Financials" title="Time ledger" description="Every hour you teach buys an hour you can learn.">
    <div className="ledger-summary"><div><span>Available balance</span><strong>{currentUser?.creditBalance ?? 0}<small> hours</small></strong></div><div><span>Total earned</span><strong className="positive">+{totals.earned}<small> hrs</small></strong></div><div><span>Total invested</span><strong>{totals.spent}<small> hrs</small></strong></div></div>
    {error && <p className="status-message error">{error}</p>}
    <section className="ledger-shell"><header><div><h2>Transaction history</h2><p>A complete record of your time-credit movement.</p></div><span>{transactions.length} entries</span></header>
      <div className="ledger-table-wrap"><table className="ledger-table"><thead><tr><th>Type</th><th>Description</th><th>Date</th><th>Amount</th></tr></thead><tbody>{transactions.map((transaction) => { const isEarning = entityId(transaction.to) === ownId; const counterpart = isEarning ? transaction.from?.name : transaction.to?.name; return <tr className="ledger-row" key={transaction._id}><td data-label="Type"><span className={`ledger-type ${isEarning ? 'earning' : 'spending'}`}><i><Icon name="arrow" size={13}/></i><span><strong>{isEarning ? 'Teaching' : 'Learning'}</strong><small>{isEarning ? 'Credit inflow' : 'Credit outflow'}</small></span></span></td><td data-label="Description"><span className="ledger-description">{isEarning ? `Earned from ${counterpart || 'a member'}` : `Sent to ${counterpart || 'a member'}`}</span></td><td data-label="Date"><time>{new Date(transaction.createdAt).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}</time></td><td data-label="Amount"><strong className={`ledger-amount ${isEarning ? 'positive' : ''}`}>{isEarning ? '+' : '−'}{transaction.amount} hr</strong></td></tr>; })}</tbody></table></div>
      {loading && <div className="ledger-loading">Loading your ledger…</div>}
      {!loading && transactions.length === 0 && !error && <div className="ledger-empty"><Icon name="wallet" size={28}/><strong>Your ledger is empty</strong><span>Complete an exchange to record your first credit movement.</span></div>}
    </section>
  </AppShell>;
}

export default CreditHistory;
