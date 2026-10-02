import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { updateUser } from '../redux/authSlice';
import { creditsLabel, errorMessage } from '../lib/format';
import Icon from './Icon';
import Modal from './Modal';
import SkillPicker from './SkillPicker';

const PUBLIC_PATHS = ['/', '/login', '/register', '/pricing', '/terms', '/privacy'];

/** First-run setup shown until a member has described themselves and picked what they want to learn. */
export default function OnboardingModal() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [bio, setBio] = useState('');
  const [wanted, setWanted] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inApp = !PUBLIC_PATHS.includes(location.pathname) && !location.pathname.startsWith('/session/');
  const needsOnboarding = Boolean(user?.id && inApp && !user.bio && !user.skillsOffered?.length && !user.skillsWanted?.length && user.teacherStatus !== 'approved');

  const next = () => {
    if (bio.trim().length < 20) { setError('Write at least 20 characters so teachers know who you are.'); return; }
    setError('');
    setStep(2);
  };

  const submit = async (event, destination = '/browse', { requireSkills = true } = {}) => {
    event?.preventDefault();
    if (requireSkills && !wanted.length) { setError('Pick at least one skill you want to learn.'); return; }
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put('/users/me', { bio: bio.trim(), skillsWanted: wanted, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      dispatch(updateUser(data));
      navigate(destination);
    } catch (err) {
      setError(errorMessage(err, 'We could not save your profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={needsOnboarding} onClose={() => {}} dismissible={false} wide title={step === 1 ? 'Welcome to SkillSwap' : 'What do you want to learn?'}
      description={step === 1 ? `Tell teachers a little about you. You already have ${creditsLabel(user?.creditBalance ?? 5)} to spend on your first lessons.` : 'We will recommend verified experts for these skills.'}>
      <form className="stack" style={{ '--gap': '18px' }} onSubmit={submit}>
        <div className="steps" aria-label={`Step ${step} of 2`}><i className="on" /><i className={step === 2 ? 'on' : ''} /></div>
        {step === 1 ? (
          <>
            <div className="field">
              <label htmlFor="onb-bio">Your introduction</label>
              <textarea id="onb-bio" className="textarea" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={500} rows={5}
                placeholder="I'm a front-end developer moving into back-end work. I want to learn Go and system design to prepare for senior roles…" />
              <span className="counter">{bio.length}/500</span>
            </div>
            {error && <p className="alert error" role="alert">{error}</p>}
            <button type="button" className="btn btn-primary btn-lg" onClick={next}>Continue <Icon name="arrow" size={16} /></button>
          </>
        ) : (
          <>
            <SkillPicker label="I want to learn" value={wanted} onChange={setWanted} max={25} />
            {error && <p className="alert error" role="alert">{error}</p>}
            <div className="row spread">
              <button type="button" className="btn btn-ghost" onClick={() => { setError(''); setStep(1); }}>Back</button>
              <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>{saving ? <span className="spinner" /> : <>Find my teacher <Icon name="arrow" size={16} /></>}</button>
            </div>
            <p className="small muted center">Are you a lecturer or an experienced engineer? <Link to="/teach" onClick={(event) => { event.preventDefault(); submit(null, '/teach', { requireSkills: false }); }}>Apply to teach and earn</Link>.</p>
          </>
        )}
      </form>
    </Modal>
  );
}
