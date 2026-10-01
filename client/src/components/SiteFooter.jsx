import { Link } from 'react-router-dom';
import Logo from './Logo';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="stack" style={{ '--gap': '12px', maxWidth: 320 }}>
          <Logo />
          <p className="small muted">Trade skills over live video. Teach what you know, learn what you want, pay in time.</p>
        </div>
        <div className="footer-cols">
          <div className="stack" style={{ '--gap': '8px' }}>
            <strong className="small">Product</strong>
            <a href="/#how">How it works</a>
            <Link to="/pricing">Pricing</Link>
            <a href="/#faq">FAQ</a>
          </div>
          <div className="stack" style={{ '--gap': '8px' }}>
            <strong className="small">Account</strong>
            <Link to="/login">Sign in</Link>
            <Link to="/register">Create account</Link>
          </div>
          <div className="stack" style={{ '--gap': '8px' }}>
            <strong className="small">Legal</strong>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </div>
        </div>
      </div>
      <div className="site-footer-base small faint">© {new Date().getFullYear()} SkillSwap. All rights reserved.</div>
    </footer>
  );
}
