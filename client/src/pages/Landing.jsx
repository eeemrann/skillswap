import { Link } from 'react-router-dom';
import './Landing.css';

function Landing() {
  return (
    <main className="landing-page">
      <nav className="landing-nav"><Link className="landing-brand" to="/"><span className="brand-mark">S</span><span>Skill<span>Swap</span></span></Link><div className="landing-nav-links"><Link to="/login">Log in</Link><Link className="landing-nav-cta" to="/register">Join the exchange <span>↗</span></Link></div></nav>
      <section className="landing-hero"><div className="landing-copy"><p className="landing-eyebrow">The community-powered classroom</p><h1>Your next skill is closer than you think.</h1><p className="landing-description">SkillSwap turns time into possibility. Teach something you know, learn something you love, and meet the people who make both possible.</p><div className="landing-actions"><Link className="landing-primary" to="/register">Start swapping <span>→</span></Link><Link className="landing-text-link" to="/login">I already have an account</Link></div><div className="landing-proof"><div className="proof-avatars"><span>AM</span><span>JP</span><span>LS</span><span>+</span></div><p><strong>Learn in good company.</strong><br />Every exchange adds a little more to the community.</p></div></div><div className="exchange-scene"><div className="scene-top"><span>LIVE EXCHANGE</span><span className="scene-dot">●</span></div><div className="scene-card scene-card-top"><span className="scene-avatar coral">AM</span><div><strong>Amara teaches</strong><small>Conversational Spanish</small></div><b>+1 hr</b></div><div className="scene-connector"><span>in return for</span></div><div className="scene-card scene-card-bottom"><span className="scene-avatar yellow">JP</span><div><strong>Jon learns</strong><small>Conversational Spanish</small></div><b>−1 hr</b></div><div className="scene-footer"><span>TIME CREDITS</span><strong>01 : 00</strong></div></div></section>
      <section className="landing-values"><div><span>01</span><h2>Bring what you know</h2><p>From baking bread to building products, your everyday expertise belongs here.</p></div><div><span>02</span><h2>Find what moves you</h2><p>Search a warm, growing network of people who are ready to share.</p></div><div><span>03</span><h2>Keep the loop going</h2><p>One hour taught earns one credit. Use it to keep your own curiosity alive.</p></div></section>
    </main>
  );
}

export default Landing;
