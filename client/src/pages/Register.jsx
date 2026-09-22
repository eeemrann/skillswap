import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignUp } from '@clerk/clerk-react';
import AuthLayout from '../components/AuthLayout';

const verificationWarning = 'Verification code delayed or restricted in development mode. Please check your Clerk dashboard test codes.';
const clerkMessage = (error) => {
  const code = error?.errors?.[0]?.code;
  if (code === 'form_identifier_not_found' || code === 'verification_expired') return verificationWarning;
  return error?.errors?.[0]?.longMessage || error?.errors?.[0]?.message || error?.message || 'Unable to create your account.';
};

export default function Register() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const navigate = useNavigate();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (!isLoaded) return;
    setBusy(true); setError('');
    try {
      if (needsVerification) {
        const result = await signUp.attemptEmailAddressVerification({ code });
        if (result.status === 'complete') { await setActive({ session: result.createdSessionId }); navigate('/dashboard', { replace: true }); }
      } else {
        await signUp.create({ emailAddress, password });
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setNeedsVerification(true);
      }
    } catch (err) { setError(clerkMessage(err)); }
    finally { setBusy(false); }
  };
  return <AuthLayout mode="register"><form className="cl-form" onSubmit={submit}>
    {!needsVerification && <><label htmlFor="register-email">Email address</label><input id="register-email" type="email" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} autoComplete="email" required /><label htmlFor="register-password">Password</label><input id="register-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required /></>}
    {needsVerification && <><p role="status">Enter the verification code sent to {emailAddress}.</p><label htmlFor="register-code">Email verification code</label><input id="register-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} required /></>}
    {error && <p role="alert" className="auth-error">{error}</p>}<button className="primary-button" type="submit" disabled={busy || !isLoaded}>{busy ? 'Please wait...' : needsVerification ? 'Verify email' : 'Create account'}</button>
  </form></AuthLayout>;
}
