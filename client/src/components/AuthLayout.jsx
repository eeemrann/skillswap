import { Link } from 'react-router-dom';
import { Brand } from './AppShell';

function AuthLayout({ children, mode }) {
  const isLogin = mode === 'login';
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link className="auth-brand" to="/"><Brand /></Link>
        <div className="auth-story-copy"><p className="page-eyebrow">Skills become possibilities</p><h1>Grow together.<br /><em>One hour at a time.</em></h1><p>Join a thoughtful community where knowledge is the currency and curiosity keeps everything moving.</p></div>
        <div className="auth-quote"><span>&ldquo;</span><p>Everyone has something worth teaching and something exciting left to learn.</p></div>
      </section>
      <section className="auth-panel"><div className="auth-form-wrap"><p className="auth-kicker">{isLogin ? 'Welcome back' : 'Join the community'}</p><h2>{isLogin ? 'Sign in to SkillSwap' : 'Create your account'}</h2><p className="auth-intro">{isLogin ? 'Your next exchange is waiting.' : 'Share what you know and discover what comes next.'}</p>{children}<p className="auth-switch">{isLogin ? 'New to SkillSwap?' : 'Already have an account?'} <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Create an account' : 'Sign in'}</Link></p></div></section>
    </main>
  );
}
export default AuthLayout;
