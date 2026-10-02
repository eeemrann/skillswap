import { fetchCatalog } from '../lib/billing';
import { FALLBACK_CATALOG } from '../lib/catalog';
import { formatCredits, formatMoney } from '../lib/format';
import { useQuery } from '../lib/hooks';
import Icon from './Icon';

const round2 = (value) => Math.round(value * 100) / 100;

/** A worked example of what a teacher earns, computed from the live catalog so it can never drift from the real rules. */
export default function EarningsExplainer({ rate = 2, hours = 1 }) {
  const { data } = useQuery(fetchCatalog, []);
  const catalog = data || FALLBACK_CATALOG;
  const economy = catalog.economy;
  const free = catalog.plans.find((plan) => plan.id === 'free');
  const pro = catalog.plans.find((plan) => plan.id === 'pro');
  const price = round2(rate * hours);

  const column = (plan) => {
    const fee = round2((price * plan.serviceFeePct) / 100);
    const net = round2(price - fee);
    return { plan, fee, net, cents: Math.round(net * economy.payoutCentsPerCredit) };
  };
  const columns = [column(free), column(pro)];

  return (
    <div className="earnings card">
      <div className="earnings-head stack" style={{ '--gap': '4px' }}>
        <span className="eyebrow">Example</span>
        <h3>A {hours}-hour session at {formatCredits(rate)} credits an hour</h3>
        <p className="small muted">The learner pays {formatCredits(price)} credits. Here is what lands in your wallet.</p>
      </div>
      <div className="earnings-grid">
        {columns.map(({ plan, fee, net, cents }) => (
          <div key={plan.id} className={`earnings-col ${plan.id === 'pro' ? 'pro' : ''}`}>
            <span className={`badge ${plan.id === 'pro' ? 'pro' : ''}`}>{plan.id === 'pro' ? <><Icon name="crown" size={12} /> Pro</> : 'Free plan'}</span>
            <dl>
              <div><dt>Session price</dt><dd>{formatCredits(price)} cr</dd></div>
              <div><dt>Platform fee ({plan.serviceFeePct}%)</dt><dd className="negative-text">−{formatCredits(fee)} cr</dd></div>
              <div className="total"><dt>You earn</dt><dd>{formatCredits(net)} cr</dd></div>
              <div><dt>Cash value</dt><dd><strong>{formatMoney(cents, catalog.currency)}</strong></dd></div>
            </dl>
          </div>
        ))}
      </div>
      <p className="tiny faint">Withdraw to your bank through Stripe at {formatMoney(economy.payoutCentsPerCredit, catalog.currency)} per credit, from {formatMoney(economy.minPayoutCents, catalog.currency)}. Earnings clear {economy.payoutHoldDays} days after a session settles.</p>
    </div>
  );
}
