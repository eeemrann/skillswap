import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../redux/authSlice';
import Icon from './Icon';

const links = [
  { to: '/dashboard', label: 'Overview', icon: 'home' },
  { to: '/browse', label: 'Discover', icon: 'search' },
  { to: '/bookings', label: 'Bookings', icon: 'calendar' },
  { to: '/messages', label: 'Messages', icon: 'message' },
  { to: '/edit-skills', label: 'My profile', icon: 'spark' },
  { to: '/credits', label: 'Credits', icon: 'wallet' }
];

export function Brand() {
  return <><span className="brand-mark"><span /></span><span className="brand-word">Skill<span>Swap</span></span></>;
}

const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SS';

function AppShell({ children, eyebrow, title, description, action }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const navLinks = user?.role === 'admin' ? [...links, { to: '/admin', label: 'Admin', icon: 'settings' }] : links;

  const handleLogout = () => { dispatch(logout()); navigate('/'); };

  return (
    <div className="app-frame">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-head"><Link className="app-brand" to="/dashboard" aria-label="SkillSwap home"><Brand /></Link><button className="icon-button sidebar-close" type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu"><Icon name="close" /></button></div>
        <div className="sidebar-label">Workspace</div>
        <nav className="app-nav" aria-label="Workspace navigation">
          {navLinks.map((item) => <NavLink key={item.to} to={item.to} className="app-nav-link" onClick={() => setMenuOpen(false)}><Icon name={item.icon} /><span>{item.label}</span></NavLink>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="credit-mini"><span className="credit-mini-icon"><Icon name="wallet" size={16} /></span><div><small>Available balance</small><strong>{user?.creditBalance ?? 0} credits</strong></div></div>
          <div className="user-menu"><span className="avatar avatar-small">{initials(user?.name)}</span><div><strong>{user?.name || 'SkillSwap member'}</strong><small>{user?.email || 'Community member'}</small></div><button className="icon-button" type="button" onClick={handleLogout} aria-label="Sign out" title="Sign out"><Icon name="logout" size={17} /></button></div>
        </div>
      </aside>
      {menuOpen && <button className="sidebar-scrim" type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
      <main className="app-main">
        <header className="mobile-header"><button className="icon-button" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Icon name="menu" /></button><Link className="app-brand" to="/dashboard"><Brand /></Link><span className="avatar avatar-small">{initials(user?.name)}</span></header>
        <div className="page-wrap page-enter">
          <header className="page-heading"><div><p className="page-eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action && <div className="page-heading-action">{action}</div>}</header>
          {children}
        </div>
      </main>
    </div>
  );
}

export default AppShell;
