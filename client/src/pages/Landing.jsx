import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import EarningsExplainer from '../components/EarningsExplainer';
import Icon from '../components/Icon';
import PricingTable from '../components/PricingTable';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import { FALLBACK_CATALOG } from '../lib/catalog';
import { useDocumentTitle } from '../lib/hooks';
import { useSkillCatalog } from '../lib/skills';
import { FAQ } from './faq';

const STEPS = [
  ['01', 'Find a verified expert', 'Search by skill, category or university. Compare lecturers, senior engineers and certified trainers by credentials, reviews and hourly rate.', 'search'],
  ['02', 'Book and pay with credits', 'Pick a time. Your credits are held in escrow only when the teacher confirms, and released after the session. No-shows are refunded automatically.', 'calendar'],
  ['03', 'Learn live, 1:1', 'Join the built-in HD room from any browser. Screen sharing and chat are included, so you can pair on real code. Nothing to install.', 'video']
];

const TRUST = [
  ['shield', 'Every teacher is verified by hand', 'Applicants submit degrees, certifications, employment and links a reviewer can check. Lecturers can prove a university mailbox. Only approved experts can be booked.'],
  ['users', 'Lecturers and working professionals', 'University staff, senior engineers, certified trainers and open-source maintainers. Each profile shows the credentials that were actually checked.'],
  ['wallet', 'You only pay for sessions that happen', 'Credits are escrowed when a session is confirmed and returned if it does not take place. Teachers are paid after you confirm, or automatically after 24 hours.']
];

const FEATURES = [
  ['video', 'Built-in video room', 'Peer-to-peer HD video, screen sharing, in-call chat and a session timer. Nothing to install, nothing recorded.'],
  ['globe', 'Teachers worldwide', 'Timezone-aware booking shows each teacher’s local time, so a lecturer in Dhaka and a learner in Toronto find a slot that works.'],
  ['star', 'Verified reviews', 'Only people who completed a session together can review each other, so ratings reflect real lessons.'],
  ['card', 'Simple, honest pricing', 'Credits cost the same for everyone. Each teacher sets an hourly rate in credits, so you always know the price before you book.'],
  ['bolt', 'Cash out in minutes', 'Teachers withdraw earnings to their bank through Stripe, in most countries, with a minimum of just $20.'],
  ['lock', 'Private by design', 'Video is encrypted and never recorded. Your exact location is never shown, only a city if you choose.']
];

function CallMock() {
  return (
    <div className="mock" aria-hidden="true">
      <div className="mock-bar"><i /><i /><i /><span>System design with Go · 00:24:18</span><b className="badge success">Live</b></div>
      <div className="mock-stage">
        <div className="mock-tile main"><span className="avatar xl">AR</span><em>Dr. Amina R. · Verified lecturer</em></div>
        <div className="mock-tile pip"><span className="avatar lg">YO</span></div>
        <div className="mock-chat"><p>Let&rsquo;s shard the key space first 🔧</p><p className="mine">Sharing my screen now</p></div>
      </div>
      <div className="mock-controls"><span><Icon name="mic" size={18} /></span><span><Icon name="video" size={18} /></span><span><Icon name="screen" size={18} /></span><span className="end"><Icon name="phoneOff" size={18} /></span></div>
    </div>
  );
}

function Categories() {
  const { categories } = useSkillCatalog();
  if (!categories.length) return null;
  return (
    <section className="section" id="skills">
      <header className="section-head"><p className="eyebrow">What you can learn</p><h2>Technology, taught by people who do it</h2><p className="muted">SkillSwap is focused on tech, so every teacher in every category is a practitioner or an academic in that field.</p></header>
      <div className="grid cols-3" style={{ '--gap': '16px' }}>
        {categories.slice(0, 9).map((category) => (
          <article className="card card-pad stack" style={{ '--gap': '10px' }} key={category.id}>
            <h3 className="card-title">{category.name}</h3>
            <div className="tags">{category.skills.slice(0, 5).map((skill) => <span className="tag" key={skill}>{skill}</span>)}{category.skills.length > 5 && <span className="tag brand">+{category.skills.length - 5} more</span>}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Landing() {
  useDocumentTitle('');
  const { isSignedIn } = useAuth();
  const welcome = FALLBACK_CATALOG.signupCredits;
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-inner">
            <div className="stack hero-copy" style={{ '--gap': '22px' }}>
              <span className="badge brand hero-badge"><Icon name="shield" size={13} /> Live 1:1 lessons from verified tech experts</span>
              <h1>Learn tech from<br /><span>people who ship it.</span></h1>
              <p className="lead">University lecturers, senior engineers and certified trainers, verified by hand, teaching you live over video. Start with {welcome} free credits. Experts: teach what you know and get paid.</p>
              <div className="row">
                <Link className="btn btn-primary btn-lg" to={isSignedIn ? '/dashboard' : '/register'}>{isSignedIn ? 'Open your workspace' : `Start with ${welcome} free credits`} <Icon name="arrow" size={18} /></Link>
                <Link className="btn btn-secondary btn-lg" to={isSignedIn ? '/teach' : '/register'}>Teach &amp; earn</Link>
              </div>
              <ul className="hero-points small muted">
                <li><Icon name="check" size={15} /> No card required to start</li>
                <li><Icon name="check" size={15} /> Teachers verified by hand</li>
                <li><Icon name="check" size={15} /> Sessions are never recorded</li>
              </ul>
            </div>
            <CallMock />
          </div>
        </section>

        <section className="section" id="how">
          <header className="section-head"><p className="eyebrow">How it works</p><h2>From “I want to learn Kubernetes” to a live lesson in minutes</h2></header>
          <div className="grid cols-3" style={{ '--gap': '20px' }}>
            {STEPS.map(([number, title, text, icon]) => (
              <article className="card card-pad step" key={number}>
                <div className="row spread"><span className="step-icon"><Icon name={icon} size={22} /></span><span className="step-number">{number}</span></div>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section alt" id="trust">
          <header className="section-head"><p className="eyebrow">Trust</p><h2>Verified, not just listed</h2><p className="muted">Anyone can say they are an expert. On SkillSwap, a person only becomes bookable after a reviewer checks their credentials.</p></header>
          <div className="grid cols-3" style={{ '--gap': '20px' }}>
            {TRUST.map(([icon, title, text]) => (
              <article className="feature" key={title}>
                <span className="feature-icon"><Icon name={icon} size={22} /></span>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <Categories />

        <section className="section alt" id="teach">
          <div className="teach-split">
            <div className="stack" style={{ '--gap': '18px' }}>
              <p className="eyebrow">For experts</p>
              <h2 style={{ fontSize: 'clamp(28px, 3.6vw, 42px)' }}>Turn what you know into income</h2>
              <p className="muted lead" style={{ fontSize: 17 }}>Lecturers and industry professionals set their own hourly rate and schedule. Every finished session earns credits that you cash out to your bank.</p>
              <ul className="stack" style={{ '--gap': '10px' }}>
                {['Apply once with your degree, certification or work history', 'A reviewer verifies you, usually within two business days', 'Set your rate, add availability and start teaching', 'Withdraw earnings through Stripe, worldwide'].map((point) => <li className="row nowrap" key={point} style={{ alignItems: 'flex-start', gap: 10 }}><Icon name="checkCircle" size={18} className="ok-icon" /><span>{point}</span></li>)}
              </ul>
              <div className="row"><Link className="btn btn-primary btn-lg" to={isSignedIn ? '/teach' : '/register'}>Apply to teach <Icon name="arrow" size={18} /></Link></div>
            </div>
            <EarningsExplainer />
          </div>
        </section>

        <section className="section" id="features">
          <header className="section-head"><p className="eyebrow">Why SkillSwap</p><h2>Everything a learning marketplace needs, nothing it does not</h2></header>
          <div className="grid cols-3" style={{ '--gap': '20px' }}>
            {FEATURES.map(([icon, title, text]) => (
              <article className="feature" key={title}>
                <span className="feature-icon"><Icon name={icon} size={22} /></span>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section alt" id="pricing">
          <header className="section-head"><p className="eyebrow">Pricing</p><h2>Pay per lesson. Upgrade when you are hooked.</h2><p className="muted">Credits never expire. Each teacher sets an hourly price in credits, so you always know the cost before you book.</p></header>
          <PricingTable />
        </section>

        <section className="section" id="faq">
          <header className="section-head"><p className="eyebrow">FAQ</p><h2>Good questions</h2></header>
          <div className="faq">
            {FAQ.map(([question, answer]) => (
              <details key={question}><summary>{question}<Icon name="chevronDown" size={18} /></summary><p className="muted">{answer}</p></details>
            ))}
          </div>
        </section>

        <section className="cta-band">
          <h2>Your next lesson is one hour away.</h2>
          <p>Create an account, claim your {welcome} free credits and book a verified expert today.</p>
          <Link className="btn btn-lg cta-btn" to={isSignedIn ? '/dashboard' : '/register'}>{isSignedIn ? 'Open your workspace' : 'Create your free account'} <Icon name="arrow" size={18} /></Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
