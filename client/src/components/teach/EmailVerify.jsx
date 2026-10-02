import { useState } from 'react';
import api from '../../api/axios';
import { errorMessage } from '../../lib/format';
import { useToast } from '../../lib/toast';
import Icon from '../Icon';

/**
 * Proves the applicant controls a university or work mailbox: we email a 6-digit code and they type it back.
 * Reviewers see the "verified" badge next to the address, which is the strongest quick signal for staff and lecturers.
 */
export default function EmailVerify({ email, onChange, initiallyVerified = false }) {
  const toast = useToast();
  const [stage, setStage] = useState(initiallyVerified && email ? 'verified' : 'idle');
  const [verifiedEmail, setVerifiedEmail] = useState(initiallyVerified ? email : '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [academic, setAcademic] = useState(false);

  const current = email.trim().toLowerCase();
  const verified = stage === 'verified' && verifiedEmail === current;

  const change = (value) => {
    onChange(value);
    if (stage !== 'idle' && value.trim().toLowerCase() !== verifiedEmail) { setStage('idle'); setCode(''); }
    setError('');
  };

  const send = async () => {
    setBusy('send');
    setError('');
    try {
      const { data } = await api.post('/teachers/email/send', { email: current });
      setAcademic(Boolean(data.academic));
      if (data.alreadyVerified) { setStage('verified'); setVerifiedEmail(current); toast.success('This address is already verified.'); } else { setStage('sent'); toast.info('We emailed you a 6-digit code.'); }
    } catch (err) {
      setError(errorMessage(err, 'We could not send the code.'));
    } finally {
      setBusy('');
    }
  };

  const verify = async () => {
    setBusy('verify');
    setError('');
    try {
      const { data } = await api.post('/teachers/email/verify', { email: current, code: code.trim() });
      setAcademic(Boolean(data.academic));
      setStage('verified');
      setVerifiedEmail(current);
      toast.success('Email verified');
    } catch (err) {
      setError(errorMessage(err, 'That code did not work.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="field">
      <label htmlFor="inst-email">University or work email <span className="faint">(recommended)</span></label>
      <div className="row nowrap" style={{ gap: 8, alignItems: 'stretch' }}>
        <input id="inst-email" className="input" type="email" value={email} onChange={(event) => change(event.target.value)} placeholder="you@university.edu" autoComplete="off" />
        {!verified && <button type="button" className="btn btn-secondary" disabled={!current || busy === 'send'} onClick={send}>{busy === 'send' ? <span className="spinner" /> : stage === 'sent' ? 'Resend' : 'Send code'}</button>}
        {verified && <span className="verified-badge"><Icon name="checkCircle" size={14} /> Verified</span>}
      </div>
      {stage === 'sent' && !verified && (
        <div className="row nowrap" style={{ gap: 8, alignItems: 'stretch' }}>
          <input className="input" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} placeholder="6-digit code" aria-label="Verification code" style={{ maxWidth: 180 }} />
          <button type="button" className="btn btn-primary" disabled={code.length !== 6 || busy === 'verify'} onClick={verify}>{busy === 'verify' ? <span className="spinner" /> : 'Verify'}</button>
        </div>
      )}
      {error && <span className="hint warn" role="alert">{error}</span>}
      <span className="hint">
        {verified ? (academic ? 'A university address. Reviewers will see it is verified.' : 'Reviewers will see that you control this address.') : 'Lecturers and employees: verifying a mailbox at your institution makes approval much faster. We only use it to check you.'}
      </span>
    </div>
  );
}
