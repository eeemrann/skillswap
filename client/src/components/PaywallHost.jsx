import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCatalog, startCheckout, yearlySaving } from '../lib/billing';
import { creditsLabel, errorMessage, formatMoney } from '../lib/format';
import { useQuery, useWindowEvent } from '../lib/hooks';
import { useToast } from '../lib/toast';
import Icon from './Icon';
import Modal from './Modal';

/**
 * Listens for 402 responses anywhere in the app and offers the fix in context:
 * a credit top-up when the wallet is short, a Pro upgrade when a plan limit is hit.
 */
export default function PaywallHost() {
  const [issue, setIssue] = useState(null);
  const [busy, setBusy] = useState('');
  const toast = useToast();
  const { data: catalog } = useQuery(fetchCatalog, [], { enabled: Boolean(issue) });
  useWindowEvent('skillswap:payment-required', (event) => setIssue(event.detail));
  const close = useCallback(() => setIssue(null), []);

  const checkout = async (key, payload) => {
    setBusy(key);
    try { await startCheckout(payload); } catch (error) { toast.error(errorMessage(error, 'Checkout is unavailable right now.')); setBusy(''); }
  };

  const pro = catalog?.plans.find((plan) => plan.id === 'pro');
  const short = issue?.code === 'INSUFFICIENT_CREDITS' || issue?.code === 'LEARNER_INSUFFICIENT_CREDITS';
  const planLimit = issue?.code === 'PLAN_LIMIT';

  return (
    <Modal open={Boolean(issue)} onClose={close} wide title={short ? 'Buy more credits' : planLimit ? 'Unlock more with Pro' : 'Upgrade required'} description={issue?.message}>
      {!catalog ? <div className="skeleton" style={{ height: 160 }} /> : (
        <div className="stack" style={{ '--gap': '20px' }}>
          {short && (
            <div className="grid cols-3" style={{ '--gap': '12px' }}>
              {catalog.packs.map((pack) => (
                <button type="button" key={pack.id} className={`pack ${pack.popular ? 'popular' : ''}`} disabled={Boolean(busy)} onClick={() => checkout(pack.id, { type: 'pack', packId: pack.id })}>
                  {pack.popular && <span className="badge brand">Best value</span>}
                  <strong>{creditsLabel(pack.credits)}</strong>
                  <span className="muted small">{formatMoney(pack.priceCents, catalog.currency)}</span>
                  {busy === pack.id && <span className="spinner" />}
                </button>
              ))}
            </div>
          )}
          {pro && (
            <div className="upsell">
              <div className="row spread nowrap">
                <div className="stack" style={{ '--gap': '4px' }}>
                  <span className="row" style={{ gap: 8 }}><span className="badge pro"><Icon name="crown" size={12} /> Pro</span><strong>{formatMoney(pro.priceMonthlyCents, catalog.currency)}/month</strong></span>
                  <span className="muted small">{pro.monthlyCredits} credit every month · {pro.serviceFeePct}% platform fee for teachers · sessions up to {pro.maxSessionMinutes / 60} hours</span>
                </div>
                <div className="row nowrap">
                  <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => checkout('month', { type: 'subscription', interval: 'month' })}>{busy === 'month' ? <span className="spinner" /> : 'Go Pro'}</button>
                  <button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => checkout('year', { type: 'subscription', interval: 'year' })}>Yearly · save {yearlySaving(pro)}%</button>
                </div>
              </div>
            </div>
          )}
          {!catalog.billingEnabled && <p className="alert warning"><Icon name="info" /> Online payments are not enabled on this deployment yet.</p>}
          <p className="small muted center">Experienced in tech? <Link to="/teach" onClick={close}>Teach to earn credits</Link> and cash them out.</p>
        </div>
      )}
    </Modal>
  );
}
