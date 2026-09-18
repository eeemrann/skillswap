import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';
import api from '../api/axios';

function CreditHistory() {
  const [transactions, setTransactions] = useState([]);
  const [message, setMessage] = useState('');
  useEffect(() => { api.get('/credits/history').then((res) => setTransactions(res.data)).catch(() => setMessage('Could not load your credit history.')); }, []);
  return <AppShell eyebrow="Your time ledger" title="Every hour counts." description="Track the time you have shared and the learning you have unlocked."><section className="surface surface-pad">{message && <p className="status-message error">{message}</p>}{!message && transactions.length === 0 && <div className="empty-state"><strong>Your ledger is waiting</strong>Complete a swap to see your first credit movement.</div>}<div className="booking-list">{transactions.map((transaction) => <div className="booking-card" key={transaction._id}><div><h3>{transaction.amount} credit {transaction.amount === 1 ? 'hour' : 'hours'}</h3><div className="booking-meta"><span>{transaction.from?._id === transaction.to?._id ? 'Exchange' : `From ${transaction.from?.name || 'a member'} to ${transaction.to?.name || 'a member'}`}</span><span>{new Date(transaction.createdAt).toLocaleString()}</span></div></div><span className="booking-status">completed</span></div>)}</div></section></AppShell>;
}

export default CreditHistory;
