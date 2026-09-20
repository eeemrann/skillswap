import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../redux/authSlice';

const links = [
  { to: '/dashboard', label: 'Overview', icon: 'OV' },
  { to: '/browse', label: 'Discover', icon: 'DS' },
  { to: '/bookings', label: 'Bookings', icon: 'BK' },
  { to: '/edit-skills', label: 'My skills', icon: 'SK' },
  { to: '/credits', label: 'Credits', icon: 'CR' },
  { to: '/messages', label: 'Messages', icon: 'MS' }
];

function Brand() {
  return <><span className="brand-mark">S</span><span>Skill<span>Swap</span></span></>;
}

function AppShell({ children, eyebrow, title, description, action }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const navigate = useNavigate();
  const handleLogout = () => { dispatch(logout()); navigate('/'); };
  const navLinks = user?.role === 'admin' ? [...links, { to: '/admin', label: 'Admin', icon: 'AD' }] : links;

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="app-brand" to="/dashboard" aria-label="SkillSwap home"><Brand /></Link>
        <div className="sidebar-label">Workspace</div>
        <nav className="app-nav" aria-label="Workspace navigation">
          {navLinks.map((item) => <NavLink key={item.to} to={item.to} className="app-nav-link"><span aria-hidden="true">{item.icon}</span>{item.label}</NavLink>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><span className="note-icon" aria-hidden="true">1:1</span><div><strong>Keep the exchange moving</strong><small>One hour taught equals one credit earned.</small></div></div>
          <button className="logout-button" type="button" onClick={handleLogout}>Sign out</button>
        </div>
      </aside>
      <main className="app-main">
        <header className="mobile-header"><Link className="app-brand" to="/dashboard"><Brand /></Link><button className="mobile-signout" type="button" onClick={handleLogout}>Sign out</button></header>
        <div className="page-wrap">
          <header className="page-heading"><div>{eyebrow && <p className="page-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action && <div className="page-heading-action">{action}</div>}</header>
          {children}
        </div>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navLinks.filter((item) => ['/dashboard', '/browse', '/bookings', '/messages', '/edit-skills'].includes(item.to)).map((item) => <NavLink key={item.to} to={item.to}><span aria-hidden="true">{item.icon}</span>{item.label}</NavLink>)}
      </nav>
    </div>
  );
}

export default AppShell;
