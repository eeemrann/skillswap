import { useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-react';
import Icon from '../components/Icon';
import EarningsExplainer from '../components/EarningsExplainer';
import PricingTable from '../components/PricingTable';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import { useDocumentTitle } from '../lib/hooks';
import { FAQ } from './faq';

const PRICING_QUESTIONS = ['How do credits work?', 'What does SkillSwap charge?', 'How do teachers cash out?', 'When does the teacher get paid?', 'What does Pro include?', 'Can I get a refund if my teacher does not show up?'];

export default function Pricing() {
  useDocumentTitle('Pricing');
  const { isSignedIn } = useAuth();
  const plan = useSelector((state) => state.auth.user?.effectivePlan);
  return (
    <>
      <SiteHeader />
      <main id="main" className="section pricing-page">
        <header className="section-head"><p className="eyebrow">Pricing</p><h1>Pay per lesson. Teachers keep most of it.</h1><p className="muted">Start with free credits. Buy more when you need them, and upgrade when you learn or teach every week.</p></header>
        <PricingTable currentPlan={isSignedIn ? plan : null} />
        <section className="stack" style={{ '--gap': '20px', marginTop: 72, alignItems: 'center' }}>
          <header className="section-head" style={{ marginBottom: 8 }}><p className="eyebrow">For teachers</p><h2>What you earn</h2><p className="muted">A small platform fee on each finished session, then cash out to your bank.</p></header>
          <div style={{ width: 'min(760px, 100%)' }}><EarningsExplainer /></div>
        </section>
        <section className="faq" style={{ marginTop: 72 }}>
          <h2 style={{ marginBottom: 16 }}>Pricing questions</h2>
          {FAQ.filter(([question]) => PRICING_QUESTIONS.includes(question)).map(([question, answer]) => (
            <details key={question}><summary>{question}<Icon name="chevronDown" size={18} /></summary><p className="muted">{answer}</p></details>
          ))}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
