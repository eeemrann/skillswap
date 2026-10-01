import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { updateUser } from '../redux/authSlice';
import { errorMessage, SKILL_SUGGESTIONS } from '../lib/format';
import Icon from './Icon';
import Modal from './Modal';
import TagInput from './TagInput';

const PUBLIC_PATHS = ['/', '/login', '/register', '/pricing', '/terms', '/privacy'];

/** First-run setup shown until a member has described themselves and listed some skills. */
export default function OnboardingModal() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [bio, setBio] = useState('');
  const [wanted, setWanted] = useState([]);
  const [offered, setOffered] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inApp = !PUBLIC_PATHS.includes(location.pathname) && !location.pathname.startsWith('/session/');
  const needsOnboarding = Boolean(user?.id && inApp && !user.bio && !user.skillsOffered?.length && !user.skillsWanted?.length);

  const next = () => {
    if (bio.trim().length < 20) { setError('Write at least 20 characters so people know who you are.'); return; }
    setError('');
    setStep(2);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!wanted.length || !offered.length) { setError('Add at least one skill to learn and one you can teach.'); return; }
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put('/users/me', { bio: bio.trim(), skillsWanted: wanted, skillsOffered: offered, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      dispatch(updateUser(data));
      navigate('/dashboard');
    } catch (err) {
      setError(errorMessage(err, 'We could not save your profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={needsOnboarding} onClose={() => {}} dismissible={false} wide title={step === 1 ? 'Welcome to SkillSwap' : 'What will you swap?'} description={step === 1 ? 'Tell people a little about you. It takes a minute.' : 'Specific skills make better matches.'}>
      <form className="stack" style={{ '--gap': '18px' }} onSubmit={submit}>
        <div className="steps" aria-label={`Step ${step} of 2`}><i className="on" /><i className={step === 2 ? 'on' : ''} /></div>
        {step === 1 ? (
          <>
            <div className="field">
              <label htmlFor="onb-bio">Your introduction</label>
              <textarea id="onb-bio" className="textarea" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={500} rows={5}
                placeholder="I'm a product designer who loves teaching prototyping and wants to learn conversational Spanish…" />
              <span className="counter">{bio.length}/500</span>
            </div>
            {error && <p className="alert error" role="alert">{error}</p>}
            <button type="button" className="btn btn-primary btn-lg" onClick={next}>Continue <Icon name="arrow" size={16} /></button>
          </>
        ) : (
          <>
            <TagInput label="I want to learn" value={wanted} onChange={setWanted} placeholder="Type a skill and press Enter" suggestions={SKILL_SUGGESTIONS} />
            <TagInput label="I can teach" value={offered} onChange={setOffered} placeholder="Type a skill and press Enter" suggestions={SKILL_SUGGESTIONS} />
            {error && <p className="alert error" role="alert">{error}</p>}
            <div className="row spread">
              <button type="button" className="btn btn-ghost" onClick={() => { setError(''); setStep(1); }}>Back</button>
              <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>{saving ? <span className="spinner" /> : <>Start swapping <Icon name="arrow" size={16} /></>}</button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
