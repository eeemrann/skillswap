import { Link } from 'react-router-dom';

function AuthLayout({ children, mode }) {
  const isLogin = mode === 'login';

  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link className="auth-brand" to="/"><span className="brand-mark">S</span><span>Skill<span>Swap</span></span></Link>
        <div className="auth-story-copy">
          <p className="page-eyebrow">A better way to grow</p>
          <h1>Learn generously.<br /><em>Live richly.</em></h1>
          <p>Exchange time, knowledge, and momentum with people who are curious about the same things you are.</p>
        </div>
        <div className="auth-quote"><span>“</span><p>Everyone has something worth teaching, and something beautiful left to learn.</p></div>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <p className="auth-kicker">{isLogin ? 'Welcome back' : 'Start your exchange'}</p>
          <h2>{isLogin ? 'Log in to SkillSwap' : 'Create your account'}</h2>
          <p className="auth-intro">{isLogin ? 'Pick up where you left off.' : 'Build a profile around what you know and what you want to discover.'}</p>
          {children}
          <p className="auth-switch">{isLogin ? 'New to SkillSwap?' : 'Already have an account?'} <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Create an account' : 'Log in'}</Link></p>
        </div>
      </section>
    </main>
  );
}

export default AuthLayout;
