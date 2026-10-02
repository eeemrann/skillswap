import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import Icon from './Icon';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

export default function SiteHeader() {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Logo />
        <nav className={`site-nav ${open ? 'open' : ''}`} aria-label="Primary">
          <a href="/#how" onClick={close}>How it works</a>
          <a href="/#trust" onClick={close}>Verified teachers</a>
          <a href="/#teach" onClick={close}>Teach &amp; earn</a>
          <NavLink to="/pricing" onClick={close}>Pricing</NavLink>
          <a href="/#faq" onClick={close}>FAQ</a>
          <div className="site-nav-actions only-mobile-flex">
            {isSignedIn ? <Link className="btn btn-primary" to="/dashboard">Open app</Link> : <><Link className="btn btn-secondary" to="/login">Sign in</Link><Link className="btn btn-primary" to="/register">Get started free</Link></>}
          </div>
        </nav>
        <div className="row nowrap site-actions">
          <ThemeToggle />
          {isSignedIn ? <Link className="btn btn-primary hide-mobile" to="/dashboard">Open app <Icon name="arrow" size={15} /></Link> : (
            <>
              <Link className="btn btn-ghost hide-mobile" to="/login">Sign in</Link>
              <Link className="btn btn-primary hide-mobile" to="/register">Get started free</Link>
            </>
          )}
          <button type="button" className="btn btn-ghost btn-icon only-mobile" onClick={() => setOpen((value) => !value)} aria-label="Menu" aria-expanded={open}><Icon name={open ? 'close' : 'menu'} /></button>
        </div>
      </div>
    </header>
  );
}
