import { Link } from 'react-router-dom';
import { Brand } from '../components/AppShell';
import Icon from '../components/Icon';
import './Landing.css';

const principles = [
  ['01', 'Professional profile', 'Document the skills you have mastered and the expertise you are actively building.'],
  ['02', 'Signal-based matching', 'Connect through expertise, availability, and distance instead of noisy social feeds.'],
  ['03', 'Atomic time credits', 'Teach for one hour and earn one credit. Spend it learning from anyone in the network.']
];

function Landing() {
  return <main className="landing-page-premium">
    <nav className="landing-nav-new"><Link className="landing-brand" to="/" aria-label="SkillSwap home"><Brand/></Link><div className="nav-links-right"><a href="#methodology">Methodology</a><Link className="login-link" to="/login">Sign in</Link><Link className="landing-nav-cta" to="/register">Join community <Icon name="arrow" size={14}/></Link></div></nav>

    <section className="hero-section-new"><div className="landing-grid-background"/><div className="hero-glow"/>
      <div className="hero-content"><div className="hero-badge"><span/> Now open for public beta</div><h1>Learn anything.<br/><em>Teach what you love.</em></h1><p className="hero-subtitle">A high-signal skill exchange for curious professionals. No subscriptions, no content treadmill—just useful knowledge moving between real people.</p><div className="hero-actions-new"><Link className="hero-primary" to="/register">Start learning free <Icon name="arrow" size={17}/></Link><a className="hero-secondary" href="#methodology">Read the methodology</a></div><div className="hero-proof-new"><div className="avatar-stack-new"><span>AM</span><span>JP</span><span>LS</span><span>+2k</span></div><p><strong>Built for generous experts</strong><small>One hour shared unlocks one hour learned.</small></p></div></div>

      <div className="hero-visual-container" aria-label="Example upcoming exchange"><div className="preview-orbit orbit-one">React <span>Expert</span></div><div className="preview-orbit orbit-two">1 credit <span>60 min</span></div><article className="glass-preview-card"><header><span className="landing-status"><i/> Upcoming exchange</span><Icon name="message" size={15}/></header><div className="session-expert"><span>HA</span><div><small>Advanced React patterns</small><strong>Hamza Bin Arif</strong></div></div><div className="session-time"><div><small>When</small><strong>Today, 6:00 PM</strong></div><div><small>Duration</small><strong>60 minutes</strong></div></div><footer><span>1.0 time credit</span><button type="button">View details <Icon name="arrow" size={13}/></button></footer></article></div>
    </section>

    <section className="landing-values-new" id="methodology"><header><p>Methodology</p><h2>A more useful way to grow.</h2><span>SkillSwap turns knowledge into a portable currency—simple enough for individuals, structured enough for professional communities.</span></header><div className="values-grid-new">{principles.map(([number, title, description]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></section>
    <footer className="landing-footer-new"><Link className="landing-brand" to="/"><Brand/></Link><p>Knowledge moves when people do.</p><div><Link to="/login">Sign in</Link><Link to="/register">Join SkillSwap</Link></div></footer>
  </main>;
}

export default Landing;
