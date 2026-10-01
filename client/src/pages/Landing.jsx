import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import Icon from '../components/Icon';
import PricingTable from '../components/PricingTable';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import { useDocumentTitle } from '../lib/hooks';
import { FAQ } from './faq';

const STEPS = [
  ['01', 'Find your match', 'Tell us what you can teach and what you want to learn. We rank members by skill fit, a true two-way swap, and overlapping availability in your timezones.', 'search'],
  ['02', 'Book a live session', 'Pick a time. Credits are held in escrow only when the teacher confirms, so nobody is ever charged for a session that does not happen.', 'calendar'],
  ['03', 'Meet on video', 'Join the built-in HD room from any browser. No downloads, no links to juggle. Screen sharing and chat are included.', 'video']
];

const FEATURES = [
  ['video', 'Built-in video room', 'Peer-to-peer HD video and audio, screen sharing, in-call chat and a live session timer. Nothing to install.'],
  ['swap', 'Time is the currency', '1 credit = 1 hour. Teach to earn credits, spend them learning, or top up when you need more.'],
  ['shield', 'Escrow protection', 'Credits are reserved when a session is confirmed and only released after it takes place. No-shows are refunded automatically.'],
  ['globe', 'Timezone-smart matching', 'Availability is compared across timezones, so you see people you can actually meet with, wherever they are.'],
  ['star', 'Verified reviews', 'Only people who completed a session together can review each other, so ratings reflect real experiences.'],
  ['lock', 'Private by design', 'Video is encrypted and never recorded. Your exact location is never shown, only a city if you choose.']
];

function CallMock() {
  return (
    <div className="mock" aria-hidden="true">
      <div className="mock-bar"><i /><i /><i /><span>Spanish conversation · 00:24:18</span><b className="badge success">Live</b></div>
      <div className="mock-stage">
        <div className="mock-tile main"><span className="avatar xl">LM</span><em>Lucía M.</em></div>
        <div className="mock-tile pip"><span className="avatar lg">YO</span></div>
        <div className="mock-chat"><p>¿Practicamos el pasado? 🎯</p><p className="mine">Sí, vamos!</p></div>
      </div>
      <div className="mock-controls"><span><Icon name="mic" size={18} /></span><span><Icon name="video" size={18} /></span><span><Icon name="screen" size={18} /></span><span className="end"><Icon name="phoneOff" size={18} /></span></div>
    </div>
  );
}

export default function Landing() {
  useDocumentTitle('');
  const { isSignedIn } = useAuth();
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-inner">
            <div className="stack hero-copy" style={{ '--gap': '22px' }}>
              <span className="badge brand hero-badge"><Icon name="spark" size={13} /> Learn live. Pay with time.</span>
              <h1>Trade your skills.<br /><span>Meet on video.</span></h1>
              <p className="lead">SkillSwap is the marketplace where you teach what you know and learn what you want, in live one-to-one video sessions. Teach for an hour, earn an hour.</p>
              <div className="row">
                <Link className="btn btn-primary btn-lg" to={isSignedIn ? '/dashboard' : '/register'}>{isSignedIn ? 'Open your workspace' : 'Start free with 3 credits'} <Icon name="arrow" size={18} /></Link>
                <a className="btn btn-secondary btn-lg" href="#how">See how it works</a>
              </div>
              <ul className="hero-points small muted">
                <li><Icon name="check" size={15} /> No card required</li>
                <li><Icon name="check" size={15} /> Works in any modern browser</li>
                <li><Icon name="check" size={15} /> Sessions are never recorded</li>
              </ul>
            </div>
            <CallMock />
          </div>
        </section>

        <section className="section" id="how">
          <header className="section-head"><p className="eyebrow">How it works</p><h2>From “I wish I could…” to a live lesson in minutes</h2></header>
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

        <section className="section alt" id="features">
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

        <section className="section" id="pricing">
          <header className="section-head"><p className="eyebrow">Pricing</p><h2>Free to start. Pro when you are hooked.</h2><p className="muted">Earn credits by teaching, or buy them when you want to learn faster.</p></header>
          <PricingTable />
        </section>

        <section className="section alt" id="faq">
          <header className="section-head"><p className="eyebrow">FAQ</p><h2>Good questions</h2></header>
          <div className="faq">
            {FAQ.map(([question, answer]) => (
              <details key={question}><summary>{question}<Icon name="chevronDown" size={18} /></summary><p className="muted">{answer}</p></details>
            ))}
          </div>
        </section>

        <section className="cta-band">
          <h2>Your next lesson is one hour away.</h2>
          <p>Join, list what you can teach, and book your first session today.</p>
          <Link className="btn btn-lg cta-btn" to={isSignedIn ? '/dashboard' : '/register'}>{isSignedIn ? 'Open your workspace' : 'Create your free account'} <Icon name="arrow" size={18} /></Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
