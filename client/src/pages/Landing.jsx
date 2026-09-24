import { Link } from 'react-router-dom';
import { Brand } from '../components/AppShell';
import Icon from '../components/Icon';
import './Landing.css';

const signals = [
  { value: '1:1', label: 'Time exchange' },
  { value: 'LOCAL', label: 'Or worldwide' },
  { value: '0%', label: 'Platform fees' },
];

function Landing() {
  return (
    <div className="foundry-root">
      <nav className="foundry-nav" aria-label="Main navigation">
        <div className="nav-inner">
          <Link to="/" className="foundry-brand" aria-label="SkillSwap home"><Brand /></Link>
          <div className="nav-links">
            <a href="#method" className="nav-item">Methodology</a>
            <Link to="/login" className="nav-item">Sign in</Link>
            <Link to="/register" className="foundry-btn-cta">Join Community</Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="foundry-hero">
          <div className="hero-atmosphere" />
          <div className="hero-grid-lines" />
          <div className="hero-content">
            <div className="foundry-badge"><span className="badge-glow" /><span className="badge-text">The Expert Exchange</span></div>
            <h1 className="hero-main-title">The market for<br /><span className="indigo-gradient-text">human expertise.</span></h1>
            <p className="hero-sub-text">Trade focused time with people who know their craft. No currency, subscriptions, or noisy feeds—just useful knowledge exchanged directly.</p>
            <div className="hero-btn-group">
              <Link to="/register" className="btn-foundry-primary">Start exchanging</Link>
              <a href="#method" className="btn-foundry-secondary">Explore the method <Icon name="arrow" size={16} /></a>
            </div>
            <div className="hero-signal-row" aria-label="Platform highlights">
              {signals.map((signal) => <div key={signal.label}><strong>{signal.value}</strong><span>{signal.label}</span></div>)}
            </div>
          </div>
        </section>

        <section className="foundry-bento" id="method">
          <div className="bento-header"><p className="eyebrow">How it works</p><h2>A focused system for useful growth.</h2><p>Every interaction is designed to move expertise between people with clarity and trust.</p></div>
          <div className="bento-grid">
            <article className="bento-card-large">
              <div className="card-viz" aria-hidden="true"><div className="viz-box"><div className="viz-line" /><div className="viz-line short" /></div><div className="viz-pulse">+1.0</div></div>
              <span className="card-index">01 / LEDGER</span><h3>Atomic Time Credits</h3><p>One hour taught becomes one hour available to learn. The ledger stays simple, transparent, and useful.</p>
            </article>
            <article className="bento-card-small"><span className="feature-icon"><Icon name="search" size={22} /></span><span className="card-index">02 / DISCOVERY</span><h3>Proximity Engine</h3><p>Find relevant expertise nearby, or expand the search to a worldwide network.</p></article>
            <article className="bento-card-small"><span className="feature-icon coral"><Icon name="message" size={22} /></span><span className="card-index">03 / SIGNAL</span><h3>Focused Communication</h3><p>Messaging opens around confirmed exchanges so conversations remain purposeful.</p></article>
          </div>
        </section>
      </main>

      <footer className="foundry-footer"><Link to="/" className="foundry-brand" aria-label="SkillSwap home"><Brand /></Link><p className="footer-copy">© {new Date().getFullYear()} SkillSwap. Precise knowledge exchange.</p></footer>
    </div>
  );
}

export default Landing;
