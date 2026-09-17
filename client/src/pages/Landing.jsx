import { Link } from 'react-router-dom';
import './Landing.css';

function Landing() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Main navigation">
        <Link className="brand" to="/">SkillSwap</Link>
        <div className="landing-nav-links">
          <Link to="/login">Log in</Link>
          <Link className="nav-cta" to="/register">Join SkillSwap</Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow">Give time. Gain skills.</p>
          <h1>Trade what you know for what you want to learn.</h1>
          <p className="hero-description">
            SkillSwap connects people who teach and learn from one another using
            simple time credits instead of money.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" to="/register">Create your account</Link>
            <Link className="secondary-action" to="/login">I already have an account</Link>
          </div>
        </div>

        <div className="swap-board" aria-label="Example skill exchange">
          <div className="board-label">A simple exchange</div>
          <div className="skill-row">
            <span className="skill-person">Maya</span>
            <span className="skill-pill">Spanish</span>
            <span className="credit">1 hour</span>
          </div>
          <div className="exchange-line"><span>earns</span></div>
          <div className="skill-row">
            <span className="skill-person">Maya</span>
            <span className="skill-pill skill-pill-alt">Guitar</span>
            <span className="credit">1 credit</span>
          </div>
        </div>
      </section>

      <section className="landing-values" aria-label="How SkillSwap works">
        <article>
          <span className="value-number">01</span>
          <h2>Share a skill</h2>
          <p>Offer something you know, from cooking to coding.</p>
        </article>
        <article>
          <span className="value-number">02</span>
          <h2>Find your match</h2>
          <p>Browse people whose skills fit what you want to learn.</p>
        </article>
        <article>
          <span className="value-number">03</span>
          <h2>Swap time</h2>
          <p>Teach for an hour, earn a credit, and keep learning.</p>
        </article>
      </section>
    </main>
  );
}

export default Landing;
