import { useState } from 'react';
import api from '../api/axios';

function EmailVerificationForm({ email, onVerified, onBack, initialMessage = '' }) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const verify = async (event) => {
    event.preventDefault(); setSubmitting(true); setError(''); setMessage('');
    try {
      const response = await api.post('/auth/verify-email', { email, code });
      setMessage(response.data.message);
      window.setTimeout(onVerified, 700);
    } catch (err) { setError(err.response?.data?.message || 'Verification failed.'); }
    finally { setSubmitting(false); }
  };

  const resend = async () => {
    setSubmitting(true); setError(''); setMessage('');
    try {
      const response = await api.post('/auth/resend-verification', { email });
      setMessage(response.data.message);
    } catch (err) { setError(err.response?.data?.message || 'Could not resend the code.'); }
    finally { setSubmitting(false); }
  };

  return <div className="verification-wrap">
    <p className="auth-intro">Enter the six-digit code sent to <strong>{email}</strong>. The code expires in 10 minutes.</p>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {message && <p className="status-message" role="status">{message}</p>}
    <form className="auth-form" onSubmit={verify}>
      <div className="form-field"><label htmlFor="verification-code">Verification code</label><input id="verification-code" className="verification-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" placeholder="123456" required /></div>
      <button className="primary-button" type="submit" disabled={submitting || code.length !== 6}>{submitting ? 'Verifying...' : 'Verify email'}</button>
    </form>
    <div className="verification-actions"><button type="button" onClick={resend} disabled={submitting}>Resend code</button>{onBack && <button type="button" onClick={onBack} disabled={submitting}>Use another email</button>}</div>
  </div>;
}

export default EmailVerificationForm;
