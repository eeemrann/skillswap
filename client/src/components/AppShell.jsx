import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../redux/authSlice';

function AppShell({ children, eyebrow, title, description, action }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="app-brand" to="/dashboard" aria-label="SkillSwap home">
          <span className="brand-mark">S</span>
          <span>Skill<span>Swap</span></span>
        </Link>
        <div className="sidebar-label">Workspace</div>
        <nav className="app-nav" aria-label="Workspace navigation">
          <NavLink to="/dashboard" className="app-nav-link"><span>⌂</span> Overview</NavLink>
          <NavLink to="/browse" className="app-nav-link"><span>⌕</span> Discover skills</NavLink>
          <NavLink to="/bookings" className="app-nav-link"><span>◷</span> My bookings</NavLink>
          <NavLink to="/edit-skills" className="app-nav-link"><span>✦</span> My skill profile</NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">✺</span>
            <div><strong>Keep the exchange moving</strong><small>One hour taught = one credit earned.</small></div>
          </div>
          <button className="logout-button" type="button" onClick={handleLogout}>↪ <span>Sign out</span></button>
        </div>
      </aside>
      <main className="app-main">
        <header className="mobile-header">
          <Link className="app-brand" to="/dashboard"><span className="brand-mark">S</span><span>Skill<span>Swap</span></span></Link>
          <button className="mobile-signout" type="button" onClick={handleLogout}>Sign out</button>
        </header>
        <div className="page-wrap">
          <header className="page-heading">
            <div>
              {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
              <h1>{title}</h1>
              {description && <p className="page-description">{description}</p>}
            </div>
            {action && <div className="page-heading-action">{action}</div>}
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}

export default AppShell;
