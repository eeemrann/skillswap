import { useState } from 'react';
import api from '../../api/axios';
import { errorMessage, formatCredits, formatDate, formatMoney } from '../../lib/format';
import { useQuery } from '../../lib/hooks';
import { useToast } from '../../lib/toast';
import EmptyState from '../EmptyState';
import Modal from '../Modal';

const STATUS = {
  pending_review: { label: 'Needs review', tone: 'warning' },
  processing: { label: 'Processing', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  rejected: { label: 'Declined', tone: 'danger' }
};
const FILTERS = [['pending_review', 'Needs review'], ['processing', 'Processing'], ['paid', 'Paid'], ['failed', 'Failed'], ['', 'All']];

/** Large withdrawals wait here. Approving sends the money; declining returns the credits to the teacher. */
export default function PayoutReviews({ onChanged }) {
  const toast = useToast();
  const [status, setStatus] = useState('pending_review');
  const [busyId, setBusyId] = useState('');
  const [declining, setDeclining] = useState(null);
  const [reason, setReason] = useState('');
  const list = useQuery(() => api.get('/admin/payouts', { params: status ? { status } : {} }).then((r) => r.data), [status], { interval: 30000 });

  const finish = () => { list.reload(); onChanged?.(); };
  const approve = async (payout) => {
    setBusyId(payout._id);
    try { const { data } = await api.post(`/admin/payouts/${payout._id}/approve`); toast.success(data.status === 'paid' ? 'Payout sent' : `Payout ${data.status}`); finish(); } catch (error) { toast.error(errorMessage(error, 'Approval failed.')); } finally { setBusyId(''); }
  };
  const decline = async (event) => {
    event.preventDefault();
    setBusyId(declining._id);
    try { await api.post(`/admin/payouts/${declining._id}/reject`, { reason }); toast.success('Payout declined, credits returned'); setDeclining(null); setReason(''); finish(); } catch (error) { toast.error(errorMessage(error, 'Could not decline.')); } finally { setBusyId(''); }
  };

  return (
    <div className="stack" style={{ '--gap': '16px' }}>
      <div className="tabs" role="tablist">{FILTERS.map(([key, label]) => <button type="button" role="tab" className="tab" key={label} aria-selected={status === key} onClick={() => setStatus(key)}>{label}</button>)}</div>
      <section className="card">
        {list.loading ? <div className="skeleton" style={{ height: 160, margin: 22 }} /> : !list.data?.length ? <EmptyState icon="wallet" title="No payouts here">Withdrawals with this status will be listed here.</EmptyState> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Requested</th><th>Teacher</th><th>Status</th><th className="num">Credits</th><th className="num">Amount</th><th /></tr></thead>
            <tbody>{list.data.map((payout) => {
              const meta = STATUS[payout.status] || { label: payout.status, tone: '' };
              return (
                <tr key={payout._id}>
                  <td className="nowrap-cell">{formatDate(payout.createdAt)}</td>
                  <td><div className="stack" style={{ '--gap': '0px' }}><strong>{payout.user?.name || 'Deleted member'}</strong><span className="tiny faint">{payout.user?.email}</span>
                    {payout.risk && <span className={`tiny ${payout.risk.unpaidLearnerSharePct >= 50 ? 'warn-text' : 'faint'}`}>{payout.risk.sessions90d} sessions · {payout.risk.uniqueLearners} learners · {payout.risk.unpaidLearnerSharePct}% of income from learners who never paid</span>}</div></td>
                  <td><span className={`badge ${meta.tone}`}>{meta.label}</span>{payout.failureReason && <span className="tiny faint" style={{ display: 'block', marginTop: 4 }}>{payout.failureReason}</span>}</td>
                  <td className="num">{formatCredits(payout.credits)}</td>
                  <td className="num">{formatMoney(payout.amountCents, payout.currency)}</td>
                  <td className="num">{payout.status === 'pending_review' && (
                    <div className="row nowrap" style={{ justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-danger btn-sm" disabled={busyId === payout._id} onClick={() => setDeclining(payout)}>Decline</button>
                      <button type="button" className="btn btn-success btn-sm" disabled={busyId === payout._id} onClick={() => approve(payout)}>{busyId === payout._id ? <span className="spinner" /> : 'Approve & send'}</button>
                    </div>
                  )}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </section>

      <Modal open={Boolean(declining)} onClose={() => setDeclining(null)} title="Decline this payout?" description="The credits go straight back to the teacher's wallet, and they receive your reason by email.">
        <form className="stack" style={{ '--gap': '14px' }} onSubmit={decline}>
          <div className="field"><label htmlFor="po-reason">Reason</label><textarea id="po-reason" className="textarea" rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} required minLength={5} /></div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setDeclining(null)}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={reason.trim().length < 5 || Boolean(busyId)}>Decline payout</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
