import { Link } from 'react-router-dom';
import { Brand } from '../components/AppShell';
import Icon from '../components/Icon';
import './Landing.css';
import.meta.env.VITE_GOOGLE_CLIENT_ID

function Landing() {
  return (
    <main className="landing-page">
      <nav className="landing-nav"><Link className="landing-brand" to="/"><Brand /></Link><div className="landing-nav-links"><a href="#how-it-works">How it works</a><Link to="/login">Sign in</Link><Link className="landing-nav-cta" to="/register">Join SkillSwap <Icon name="arrow" size={15}/></Link></div></nav>
      <section className="landing-hero">
        <div className="landing-copy"><div className="landing-pill"><span /> Community-powered learning</div><h1>Learn anything.<br/><span>Teach what you love.</span></h1><p className="landing-description">A trusted place to exchange real skills with real people. No subscriptions, no awkward pricing&mdash;just time, curiosity, and community.</p><div className="landing-actions"><Link className="landing-primary" to="/register">Start learning free <Icon name="arrow" /></Link><a className="landing-text-link" href="#how-it-works">See how it works</a></div><div className="landing-proof"><div className="proof-avatars"><span>AM</span><span>JP</span><span>LS</span><span>+2k</span></div><p><strong>A community built on generosity</strong><br/>Share one hour. Unlock another.</p></div></div>
        <div className="hero-visual" aria-label="Example skill exchange"><div className="visual-glow"/><div className="floating-chip chip-one">Photography <span>+1 hr</span></div><div className="floating-chip chip-two">Spanish <span>Booked</span></div><div className="exchange-scene"><div className="scene-head"><span>Upcoming exchange</span><span className="live-dot">Confirmed</span></div><div className="scene-person"><span className="scene-avatar">AM</span><div><strong>Spanish with Emran</strong><small>Today, 6:30 PM &middot; 60 minutes</small></div></div><div className="scene-divider"/><div className="scene-meta"><div><small>Your balance</small><strong>8.5 credits</strong></div><div className="scene-people"><span>JL</span><span>MR</span><span>+4</span></div></div><button type="button">View session <Icon name="arrow" size={15}/></button></div></div>
      </section>
      <section className="landing-values" id="how-it-works"><div className="value-heading"><p className="landing-eyebrow">Simple by design</p><h2>Your knowledge is already valuable.</h2></div>{[['01','Create your profile','Share the skills you know and the ones you are ready to discover.'],['02','Meet your match','Browse trusted community members and find the right person to learn from.'],['03','Exchange and grow','Teach for an hour, earn a credit, and spend it learning something new.']].map(([n,t,d])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}</section>
    </main>
  );
}
export default Landing;
