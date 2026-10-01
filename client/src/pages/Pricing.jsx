import { useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-react';
import Icon from '../components/Icon';
import PricingTable from '../components/PricingTable';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import { useDocumentTitle } from '../lib/hooks';
import { FAQ } from './faq';

export default function Pricing() {
  useDocumentTitle('Pricing');
  const { isSignedIn } = useAuth();
  const plan = useSelector((state) => state.auth.user?.effectivePlan);
  return (
    <>
      <SiteHeader />
      <main id="main" className="section pricing-page">
        <header className="section-head"><p className="eyebrow">Pricing</p><h1>Simple pricing that grows with you</h1><p className="muted">Start free. Upgrade when swapping becomes a habit.</p></header>
        <PricingTable currentPlan={isSignedIn ? plan : null} />
        <section className="faq" style={{ marginTop: 72 }}>
          <h2 style={{ marginBottom: 16 }}>Pricing questions</h2>
          {FAQ.filter(([question]) => /credits|Pro|cash|charged|teacher/i.test(question)).map(([question, answer]) => (
            <details key={question}><summary>{question}<Icon name="chevronDown" size={18} /></summary><p className="muted">{answer}</p></details>
          ))}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
