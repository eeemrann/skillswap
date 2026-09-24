import { useState } from 'react';
import { useSignIn } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';

export default function Login() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const navigate = useNavigate();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    if (!isLoaded || submitting) return;
    setSubmitting(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/dashboard',
      });
    } catch {
      setError('Google sign-in failed.');
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoaded || submitting) return;
    setSubmitting(true);
    try {
      const result = await signIn.create({ identifier: emailAddress, password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.errors[0]?.longMessage || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout mode="login">
      <div className="form-container-inner fade-in">
        {error && <div className="auth-inline-error">{error}</div>}
        
        {/* MATCHES REGISTER PAGE STYLE */}
        <button className="google-auth-button" type="button" onClick={handleGoogleSignIn}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/>
            <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/>
            <path fill="#FBBC05" d="M6.39 13.93A6 6 0 0 1 6.08 12c0-.67.12-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.55l3.35-2.62Z"/>
            <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-form-divider"><span>or continue with email</span></div>

        <form onSubmit={handleSubmit} className="custom-clerk-form">
          <div className="auth-field">
            <label>Email Address</label>
            <input 
              type="email" 
              placeholder="Enter your email address" 
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              required 
            />
          </div>
          <div className="auth-field">
            <div className="auth-field-heading">
               <label>Password</label>
               <span>Secure credentials</span>
            </div>
            <div className="password-field-wrap">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Enter your password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <button className="auth-submit-button" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in securely"}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}