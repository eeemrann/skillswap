import { useState } from 'react';
import { UserButton } from '@clerk/clerk-react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { formatCredits } from '../lib/format';
import { useDocumentTitle, useEscape, useScrollLock } from '../lib/hooks';
import Icon from './Icon';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';

const LINKS = [
  { to: '/dashboard', label: 'Overview', icon: 'home' },
  { to: '/browse', label: 'Discover', icon: 'search' },
  { to: '/bookings', label: 'Sessions', icon: 'video', badge: ['booking', 'session'] },
  { to: '/messages', label: 'Messages', icon: 'message', badge: ['message'] },
  { to: '/teach', label: 'Teach & earn', icon: 'bolt', teacher: true },
  { to: '/billing', label: 'Wallet & plan', icon: 'wallet' },
  { to: '/settings', label: 'Profile', icon: 'user' }
];
const TABS = ['/dashboard', '/browse', '/bookings', '/messages'];

function AppShell({ children, eyebrow, title, description, action, wide = false }) {
  const user = useSelector((state) => state.auth.user);
  const counts = useSelector((state) => state.notifications.counts);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useDocumentTitle(title);
  useScrollLock(menuOpen);
  useEscape(menuOpen, () => setMenuOpen(false));

  const links = user?.role === 'admin' ? [...LINKS, { to: '/admin', label: 'Admin', icon: 'shield' }] : LINKS;
  const badgeFor = (item) => (item.badge || []).reduce((sum, type) => sum + (counts[type] || 0), 0);
  const isPro = user?.effectivePlan === 'pro';
  const teacherStatus = user?.teacherStatus || 'none';

  const renderNav = (items, onNavigate) => items.map((item) => {
    const count = badgeFor(item);
    return (
      <NavLink key={item.to} to={item.to} className="nav-link" onClick={onNavigate}>
        <Icon name={item.icon} />
        <span className="grow">{item.teacher && teacherStatus === 'approved' ? 'My teaching' : item.label}</span>
        {item.teacher && teacherStatus === 'pending' && <span className="badge warning">In review</span>}
        {count > 0 && <span className="count-badge" aria-label={`${count} unread`}>{count > 99 ? '99+' : count}</span>}
      </NavLink>
    );
  });

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Main">
        <div className="sidebar-top"><Logo to="/dashboard" /><button type="button" className="btn btn-ghost btn-icon btn-sm only-mobile" onClick={() => setMenuOpen(false)} aria-label="Close menu"><Icon name="close" /></button></div>
        <nav className="nav" aria-label="Workspace">{renderNav(links, () => setMenuOpen(false))}</nav>
        <div className="sidebar-foot">
          {isPro ? (
            <div className="plan-card pro"><span className="badge pro"><Icon name="crown" size={12} /> Pro</span><p className="small">{user?.limits?.serviceFeePct ?? 6}% platform fee and priority placement are active.</p></div>
          ) : (
            <Link to="/billing" className="plan-card" onClick={() => setMenuOpen(false)}>
              <strong><Icon name="crown" size={15} /> Go Pro</strong>
              <p className="small">Half the platform fee, a bonus credit every month, longer sessions.</p>
              <span className="small bold">See plans <Icon name="arrow" size={13} /></span>
            </Link>
          )}
          <div className="user-row">
            <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: { width: 36, height: 36 } } }} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="bold small truncate">{user?.name || 'Member'}</div>
              <div className="tiny faint truncate">{user?.email}</div>
            </div>
          </div>
        </div>
      </aside>
      {menuOpen && <button type="button" className="scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <div className="shell-main">
        <header className="topbar">
          <button type="button" className="btn btn-ghost btn-icon only-mobile" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <div className="only-mobile"><Logo to="/dashboard" compact /></div>
          <div className="grow" />
          <Link to="/billing" className="credit-chip" title="Spendable credits for live sessions"><span className="coin">C</span>{formatCredits(user?.availableCredits ?? user?.creditBalance ?? 0)} credits</Link>
          <ThemeToggle />
          <NotificationBell />
        </header>

        <main id="main" className={`page ${wide ? 'wide' : ''}`} key={location.pathname}>
          <div className="page-enter">
            {title && (
              <header className="page-head">
                <div className="stack" style={{ '--gap': '6px' }}>
                  {eyebrow && <p className="eyebrow">{eyebrow}</p>}
                  <h1>{title}</h1>
                  {description && <p className="muted page-desc">{description}</p>}
                </div>
                {action && <div className="row">{action}</div>}
              </header>
            )}
            {children}
          </div>
        </main>
      </div>

      <nav className="tabbar" aria-label="Quick navigation">
        {LINKS.filter((item) => TABS.includes(item.to)).map((item) => {
          const count = badgeFor(item);
          return (
            <NavLink key={item.to} to={item.to} className="tab-link">
              <Icon name={item.icon} size={22} />
              <span>{item.label}</span>
              {count > 0 && <i className="tab-dot" />}
            </NavLink>
          );
        })}
        <button type="button" className="tab-link" onClick={() => setMenuOpen(true)}><Icon name="menu" size={22} /><span>More</span></button>
      </nav>
    </div>
  );
}

export default AppShell;
