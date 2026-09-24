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
  { to: '/edit-skills', label: 'My Profile', icon: 'spark' },
  { to: '/credits', label: 'Credits', icon: 'wallet' }
];

export function Brand() {
  return (
    <span className="glass-brand foundry-brand-lockup">
      <span className="glass-brand-mark foundry-brand-mark">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" aria-hidden="true"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/></svg>
      </span>
      <span className="brand-word">SKILLSWAP</span>
    </span>
  );
}

const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SS';

function AppShell({ children, eyebrow, title, description, action }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const notificationCounts = useSelector((state) => state.notifications.counts);
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');
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
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        api.patch('/users/me/location', { longitude: coords.longitude, latitude: coords.latitude }).catch(() => {});
      }, () => {}, { maximumAge: 600000, timeout: 10000 });
    };
    syncLocation();
    window.addEventListener('online', syncLocation);
    window.addEventListener('focus', syncLocation);
    return () => { window.removeEventListener('online', syncLocation); window.removeEventListener('focus', syncLocation); };
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape); };
  }, [menuOpen]);

  const handleLogout = async () => {
    dispatch(clearNotifications());
    dispatch(logout());
    await signOut();
    navigate('/');
  };
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem('skillswap-theme', nextTheme);
  };
  const badgeFor = (path) => path === '/dashboard' ? notificationCounts.all : path === '/bookings' ? notificationCounts.booking : path === '/messages' ? notificationCounts.message : 0;

  return (
    <div className={`app-frame glass-workspace theme-${theme}`}>
      <aside className={`sidebar sidebar-premium sidebar-foundry ${menuOpen ? 'open' : ''}`}>
        <div className="glass-sidebar-brand foundry-sidebar-brand"><Link to="/dashboard" aria-label="SkillSwap workspace"><Brand /></Link></div>
        <div className="sidebar-label">Workspace</div>
        <nav className="glass-nav foundry-nav-list" aria-label="Workspace navigation">
          {navLinks.map((item) => {
            const count = badgeFor(item.to);
            return <NavLink key={item.to} to={item.to} className="nav-link-glass nav-link-foundry" onClick={() => setMenuOpen(false)}><Icon name={item.icon} size={18}/><span>{item.label}</span>{count > 0 && <span className="notification-badge" aria-label={`${count} unread notifications`}>{count > 99 ? '99+' : count}</span>}</NavLink>;
          })}
        </nav>
        <div className="sidebar-theme-control">
          <span><Icon name={theme === 'dark' ? 'moon' : 'sun'} size={15}/><span>Appearance</span></span>
          <button className="theme-switch" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-pressed={theme === 'light'}><span /></button>
        </div>
        <div className="glass-user-card foundry-user-card">
          <UserButton appearance={{ elements: { avatarBox: 'avatar avatar-small' } }} afterSignOutUrl="/" />
          <div className="glass-user-copy"><strong>{user?.name || clerkUser?.fullName || 'SkillSwap member'}</strong><small>{user?.creditBalance ?? 0} Credits</small></div>
          <button className="icon-button" type="button" onClick={handleLogout} aria-label="Sign out" title="Sign out"><Icon name="logout" size={17}/></button>
        </div>
      </aside>

      {menuOpen && <button className="sidebar-scrim" type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
      <main className="app-main glass-main foundry-main">
        <header className="mobile-header"><button className="icon-button" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Icon name="menu" /></button><Link className="app-brand" to="/dashboard"><Brand /></Link><div className="mobile-header-actions"><button className="icon-button theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17}/></button><span className="avatar avatar-small">{initials(user?.name)}</span></div></header>
        <div className="page-wrap glass-page-wrap foundry-page-wrap page-enter">
          <header className="glass-page-heading foundry-page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-heading-action">{action}</div>}</header>
          {children}
        </div>
      </main>
    </div>
  );
}

export default AppShell;
