import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { fetchCatalog, perCredit, startCheckout, yearlySaving } from '../lib/billing';
import { FALLBACK_CATALOG } from '../lib/catalog';
import { creditsLabel, errorMessage, formatMoney } from '../lib/format';
import { useQuery } from '../lib/hooks';
import { useToast } from '../lib/toast';
import Icon from './Icon';

/** Plans plus credit packs. Used on the landing page, the pricing page and inside the app. */
export default function PricingTable({ currentPlan = null, showPacks = true, showPlans = true }) {
  const { isSignedIn } = useAuth();
  const toast = useToast();
  const { data } = useQuery(fetchCatalog, []);
  const catalog = data || FALLBACK_CATALOG;
  const [interval, setPeriod] = useState('year');
  const [busy, setBusy] = useState('');
  const free = catalog.plans.find((plan) => plan.id === 'free');
  const pro = catalog.plans.find((plan) => plan.id === 'pro');
  const saving = yearlySaving(pro);
  const price = interval === 'year' ? Math.round(pro.priceYearlyCents / 12) : pro.priceMonthlyCents;

  const buy = async (key, payload) => {
    setBusy(key);
    try { await startCheckout(payload); } catch (error) { toast.error(errorMessage(error, 'Checkout is unavailable right now.')); setBusy(''); }
  };

  return (
    <div className="stack" style={{ '--gap': '40px' }}>
      {showPlans && <div className="stack" style={{ alignItems: 'center', '--gap': '14px' }}>
        <div className="tabs" role="tablist" aria-label="Billing period">
          <button type="button" role="tab" className="tab" aria-selected={interval === 'month'} onClick={() => setPeriod('month')}>Monthly</button>
          <button type="button" role="tab" className="tab" aria-selected={interval === 'year'} onClick={() => setPeriod('year')}>Yearly <span className="badge success">Save {saving}%</span></button>
        </div>
      </div>}

      {showPlans && <div className="plans">
        <article className="plan card">
          <header className="stack" style={{ '--gap': '6px' }}>
            <h3>{free.name}</h3>
            <p className="muted small">{free.tagline}</p>
          </header>
          <p className="plan-price"><strong>{formatMoney(0)}</strong><span className="muted">forever</span></p>
          <p className="small muted">Includes {creditsLabel(catalog.signupCredits)} to start.</p>
          <ul className="plan-features">{free.features.map((feature) => <li key={feature}><Icon name="check" size={16} />{feature}</li>)}</ul>
          {currentPlan === 'free' ? <span className="btn btn-secondary btn-block" aria-disabled="true">Your current plan</span>
            : <Link className="btn btn-secondary btn-block" to={isSignedIn ? '/dashboard' : '/register'}>{isSignedIn ? 'Open app' : 'Start for free'}</Link>}
        </article>

        <article className="plan card featured">
          <span className="badge pro plan-flag"><Icon name="crown" size={12} /> Most popular</span>
          <header className="stack" style={{ '--gap': '6px' }}>
            <h3>{pro.name}</h3>
            <p className="muted small">{pro.tagline}</p>
          </header>
          <p className="plan-price"><strong>{formatMoney(price, catalog.currency)}</strong><span className="muted">/ month{interval === 'year' ? `, billed ${formatMoney(pro.priceYearlyCents, catalog.currency)} yearly` : ''}</span></p>
          <p className="small muted">{interval === 'year' ? `${pro.monthlyCredits * 12} credits up front each year` : `${pro.monthlyCredits} credits every month`}. Cancel anytime.</p>
          <ul className="plan-features">{pro.features.map((feature) => <li key={feature}><Icon name="check" size={16} />{feature}</li>)}</ul>
          {currentPlan === 'pro' ? <span className="btn btn-secondary btn-block" aria-disabled="true">Your current plan</span>
            : isSignedIn
              ? <button type="button" className="btn btn-primary btn-block" disabled={Boolean(busy)} onClick={() => buy(interval, { type: 'subscription', interval })}>{busy ? <span className="spinner" /> : 'Upgrade to Pro'}</button>
              : <Link className="btn btn-primary btn-block" to="/register">Get Pro</Link>}
        </article>
      </div>}

      {showPacks && (
        <section className="stack" style={{ '--gap': '16px' }}>
          <div className="stack" style={{ '--gap': '4px', textAlign: 'center' }}>
            <h3 style={{ fontSize: 22 }}>Or just top up</h3>
            <p className="muted">Credits never expire. 1 credit buys 1 hour with any teacher.</p>
          </div>
          <div className="grid cols-3">
            {catalog.packs.map((pack) => {
              const base = perCredit(catalog.packs[0]);
              const discount = Math.round((1 - perCredit(pack) / base) * 100);
              return (
                <article className={`card pack-card ${pack.popular ? 'featured' : ''}`} key={pack.id}>
                  {pack.popular && <span className="badge brand">Best value</span>}
                  <h4>{pack.name}</h4>
                  <p className="plan-price"><strong>{formatMoney(pack.priceCents, catalog.currency)}</strong></p>
                  <p className="small muted">{creditsLabel(pack.credits)} · {formatMoney(Math.round(perCredit(pack)), catalog.currency)} each{discount > 0 ? ` · save ${discount}%` : ''}</p>
                  {isSignedIn
                    ? <button type="button" className="btn btn-secondary btn-block" disabled={Boolean(busy)} onClick={() => buy(pack.id, { type: 'pack', packId: pack.id })}>{busy === pack.id ? <span className="spinner" /> : 'Buy credits'}</button>
                    : <Link className="btn btn-secondary btn-block" to="/register">Get started</Link>}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
