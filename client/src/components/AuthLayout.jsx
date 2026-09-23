import { Link } from 'react-router-dom';
import { Brand } from './AppShell';

function AuthLayout({ children, mode }) {
  const isLogin = mode === 'login';
  return <main className="auth-page-premium">
    <section className="auth-story-dark"><div className="auth-grid-background"/><Link className="auth-brand-new" to="/"><Brand/></Link><div className="auth-story-main"><p>Knowledge compounds</p><h2>Grow together.<br/><span>One hour at a time.</span></h2><div>Join a global network of experts trading useful knowledge without the overhead of traditional learning platforms.</div></div><blockquote><p>“SkillSwap is where focused people find the niche expertise tutorials cannot provide.”</p><cite>Independent product designer</cite></blockquote></section>
    <section className="auth-form-side"><div className="auth-form-premium"><header><p>{isLogin ? 'Welcome back' : 'Get started'}</p><h1>{isLogin ? 'Sign in' : 'Create account'}</h1><span>{isLogin ? 'Continue to your SkillSwap workspace.' : 'Start exchanging what you know.'}</span></header>{children}<p className="auth-switch-new">{isLogin ? 'New to SkillSwap?' : 'Already have an account?'} <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Create an account' : 'Sign in'}</Link></p></div></section>
  </main>;
}

export default AuthLayout;
