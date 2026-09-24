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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isLoaded || submitting) return;

    setSubmitting(true);
    setError('');
    try {
      const result = await signIn.create({ identifier: emailAddress.trim(), password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        navigate('/dashboard', { replace: true });
        return;
      }
      setError('Additional verification is required for this account.');
    } catch (requestError) {
      const clerkError = requestError?.errors?.[0];
      setError(clerkError?.longMessage || clerkError?.message || 'Unable to sign in with those credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout mode="login">
      <form className="custom-clerk-form" onSubmit={handleSubmit}>
        {error && <div className="auth-inline-error" role="alert">{error}</div>}
        <div className="auth-field">
          <label htmlFor="login-email">Email address</label>
          <input id="login-email" type="email" autoComplete="email" value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} placeholder="you@example.com" required />
        </div>
        <div className="auth-field">
          <div className="auth-field-heading"><label htmlFor="login-password">Password</label><span>Secure credentials</span></div>
          <div className="password-field-wrap">
            <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={`${showPassword ? 'Hide' : 'Show'} password`}>{showPassword ? 'Hide' : 'Show'}</button>
          </div>
        </div>
        <button className="auth-submit-button" type="submit" disabled={!isLoaded || submitting}>{submitting ? 'Signing in...' : 'Sign in securely'}</button>
      </form>
    </AuthLayout>
  );
}
