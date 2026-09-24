import { Link } from 'react-router-dom';
import { Brand } from './AppShell';

function AuthLayout({ children, mode }) {
  const isLogin = mode === 'login';

  return (
    <main className="foundry-auth-page auth-viewport-locked">
      <section className="auth-visual-side">
        <div className="auth-grid-overlay" />
        <div className="auth-atmosphere-glow" />
        <div className="auth-visual-content">
          <Link to="/" className="auth-back-home" aria-label="SkillSwap home"><Brand /></Link>
          <div className="auth-statement">
            <p className="eyebrow">Expertise Vault</p>
            <h2>{isLogin ? 'Welcome back to the exchange.' : 'Join the next generation.'}</h2>
            <p className="auth-description">Access a global network of focused professionals trading niche expertise.</p>
          </div>
          <div className="auth-footer-badge"><span className="secure-dot" />Encrypted Session Active</div>
        </div>
      </section>

      <section className="auth-form-side">
        <div className="form-container-inner fade-in">
          <header className="form-header-premium">
            <h1>{isLogin ? 'Sign In' : 'Register'}</h1>
            <p>{isLogin ? 'Provide your credentials' : 'Create your expert profile'}</p>
          </header>
          <div className="clerk-wrapper-foundry">{children}</div>
          <footer className="auth-form-footer"><p>{isLogin ? 'New here?' : 'Already a member?'}{' '}<Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Create account' : 'Log in'}</Link></p></footer>
        </div>
      </section>
    </main>
  );
}

export default AuthLayout;
