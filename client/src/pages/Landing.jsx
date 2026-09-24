import { Link } from 'react-router-dom';
import { Brand } from '../components/AppShell';
import Icon from '../components/Icon';
import './Landing.css';

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

      <section className="foundry-hero">
        <div className="hero-atmosphere" />
        <div className="hero-grid-lines" />
        <div className="hero-content">
          <div className="foundry-badge">
            <span className="badge-glow" />
            <span className="badge-text">v2.0 — The Expert Exchange</span>
          </div>
          <h1 className="hero-main-title">The market for <br /><span className="indigo-gradient-text">human expertise.</span></h1>
          <p className="hero-sub-text">SkillSwap is a precision-engineered platform for trading high-signal skills. No currency. No subscriptions. Just focused time between experts.</p>
          <div className="hero-btn-group">
            <Link to="/register" className="btn-foundry-primary">Get Started free</Link>
            <a href="#method" className="btn-foundry-secondary"><Icon name="arrow" size={16} /> How it works</a>
          </div>
        </div>
      </section>

      <section className="foundry-bento" id="method">
        <div className="bento-header"><p className="eyebrow">The Foundry</p><h2>Engineered for useful growth.</h2></div>
        <div className="bento-grid">
          <div className="bento-card-large">
            <div className="card-viz" aria-hidden="true"><div className="viz-box"><div className="viz-line" /><div className="viz-line short" /></div><div className="viz-pulse">+1.0</div></div>
            <h3>Atomic Time Credits</h3><p>A simple, immutable ledger. One hour taught is one hour earned. No math, no inflation.</p>
          </div>
          <div className="bento-card-small"><Icon name="search" size={24} className="indigo-icon" /><h3>Proximity Engine</h3><p>Smart geospatial matching for local and worldwide expertise.</p></div>
          <div className="bento-card-small"><Icon name="message" size={24} className="indigo-icon" /><h3>Signal Only</h3><p>Gated messaging ensures communication only happens when a match is confirmed.</p></div>
        </div>
      </section>

      <footer className="foundry-footer">
        <Link to="/" className="foundry-brand" aria-label="SkillSwap home"><Brand /></Link>
        <p className="footer-copy">© 2024 SkillSwap. Precise Knowledge Exchange.</p>
      </footer>
    </div>
  );
}

export default Landing;
