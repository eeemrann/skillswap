import { Link } from 'react-router-dom';
import Icon from './Icon';
import Logo from './Logo';

const POINTS = [
  ['video', 'Live HD video sessions, right in your browser'],
  ['swap', 'Teach for an hour, earn an hour to spend learning'],
  ['shield', 'Credits are held in escrow until your session happens']
];

function AuthLayout({ children, mode }) {
  const isLogin = mode === 'login';
  return (
    <main className="auth">
      <section className="auth-story">
        <Logo className="on-dark" />
        <div className="stack" style={{ '--gap': '22px' }}>
          <h2>Learn anything.<br /><span>Pay with what you know.</span></h2>
          <ul className="stack" style={{ '--gap': '14px' }}>
            {POINTS.map(([icon, text]) => <li key={text} className="row nowrap"><span className="auth-point"><Icon name={icon} size={18} /></span>{text}</li>)}
          </ul>
        </div>
        <p className="small">New members start with free credits, no card needed.</p>
      </section>
      <section className="auth-form">
        <div className="auth-form-inner">
          <header className="stack" style={{ '--gap': '6px' }}>
            <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
            <p className="muted">{isLogin ? 'Sign in to continue to your sessions.' : 'Start swapping skills in under a minute.'}</p>
          </header>
          {children}
          <p className="small muted center">{isLogin ? 'New to SkillSwap?' : 'Already have an account?'} <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Create an account' : 'Sign in'}</Link></p>
          {!isLogin && <p className="tiny faint center">By continuing you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</p>}
        </div>
      </section>
    </main>
  );
}

export default AuthLayout;
