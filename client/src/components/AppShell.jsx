import { useEffect, useState } from 'react';
import { useClerk, UserButton, useUser } from '@clerk/clerk-react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../redux/authSlice';
import { clearNotifications, fetchUnreadCounts } from '../redux/notificationSlice';
import api from '../api/axios';
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
  return <><span className="brand-mark-new"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 2 7l10 5 10-5-10-5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg></span><span className="brand-word">SKILLSWAP</span></>;
}

const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SS';

function AppShell({ children, eyebrow, title, description, action }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const notificationCounts = useSelector((state) => state.notifications.counts);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const navLinks = user?.role === 'admin' ? [...links, { to: '/admin', label: 'Admin', icon: 'settings' }] : links;

  useEffect(() => {
    const refresh = () => { if (!document.hidden) dispatch(fetchUnreadCounts()); };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [dispatch]);

  useEffect(() => {
    const syncLocation = () => {
      if (document.hidden || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          api.patch('/users/me/location', {
            longitude: coords.longitude,
            latitude: coords.latitude
          }).catch(() => {});
        },
        () => {},
        { maximumAge: 600000, timeout: 10000 }
      );
    };

    syncLocation();
    window.addEventListener('online', syncLocation);
    window.addEventListener('focus', syncLocation);
    return () => {
      window.removeEventListener('online', syncLocation);
      window.removeEventListener('focus', syncLocation);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const handleLogout = async () => { dispatch(clearNotifications()); dispatch(logout()); await signOut(); navigate('/'); };
  const badgeFor = (path) => path === '/dashboard'
    ? notificationCounts.all
    : path === '/bookings' ? notificationCounts.booking
      : path === '/messages' ? notificationCounts.message : 0;

  return (
    <div className="app-frame">
      <aside className={`sidebar sidebar-premium ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-head">
  <Link className="app-brand" to="/dashboard" aria-label="SkillSwap home">
    <Brand />
  </Link>
</div>
        <div className="sidebar-label">Workspace</div>
        <nav className="app-nav" aria-label="Workspace navigation">
          {navLinks.map((item) => { const count = badgeFor(item.to); return <NavLink key={item.to} to={item.to} className="app-nav-link" onClick={() => setMenuOpen(false)}><Icon name={item.icon} /><span>{item.label}</span>{count > 0 && <span className="notification-badge" aria-label={`${count} unread notifications`}>{count > 99 ? '99+' : count}</span>}</NavLink>; })}
        </nav>
        <div className="sidebar-bottom">
          <div className="credit-mini"><span className="credit-mini-icon"><Icon name="wallet" size={16} /></span><div><small>Available balance</small><strong>{user?.creditBalance ?? 0} credits</strong></div></div>
          <div className="user-menu"><UserButton appearance={{ elements: { avatarBox: 'avatar avatar-small' } }} afterSignOutUrl="/" /><div><strong>{user?.name || clerkUser?.fullName || 'SkillSwap member'}</strong><small>{user?.email || clerkUser?.primaryEmailAddress?.emailAddress || 'Community member'}</small></div><button className="icon-button" type="button" onClick={handleLogout} aria-label="Sign out" title="Sign out"><Icon name="logout" size={17} /></button></div>
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
