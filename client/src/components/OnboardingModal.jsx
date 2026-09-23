import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import api from '../api/axios';
import { updateUser } from '../redux/authSlice';
import Icon from './Icon';

const parseSkills = (value) => [...new Set(value.split(',').map((skill) => skill.trim()).filter(Boolean))];

function SkillInput({ id, label, value, onChange, placeholder }) {
  const skills = useMemo(() => parseSkills(value), [value]);
  return <div className="onboarding-field"><label htmlFor={id}>{label}</label><input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete="off"/><div className="onboarding-tags">{skills.map((skill) => <span key={skill}>{skill}<button type="button" onClick={() => onChange(skills.filter((item) => item !== skill).join(', '))} aria-label={`Remove ${skill}`}>&times;</button></span>)}</div></div>;
}

export default function OnboardingModal() {
  const user = useSelector((state) => state.auth.user);
  const { isSignedIn, isLoaded } = useAuth();
  const { isLoaded: isUserLoaded } = useUser();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const dialogRef = useRef(null);
  const [step, setStep] = useState(1);
  const [bio, setBio] = useState('');
  const [wanted, setWanted] = useState('');
  const [offered, setOffered] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const userId = user?.id || user?._id;
  const isAppRoute = !['/', '/login', '/register'].includes(location.pathname);
  const needsOnboarding = Boolean(isLoaded && isUserLoaded && isSignedIn && userId && isAppRoute && !user.bio && !(user.skillsOffered?.length) && !(user.skillsWanted?.length));
  const wantedSkills = useMemo(() => parseSkills(wanted), [wanted]);
  const offeredSkills = useMemo(() => parseSkills(offered), [offered]);

  useEffect(() => {
    if (!needsOnboarding) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => dialogRef.current?.querySelector('textarea, input')?.focus(), 150);
    return () => { document.body.style.overflow = previousOverflow; window.clearTimeout(timer); };
  }, [needsOnboarding, step]);

  if (!needsOnboarding) return null;

  const continueToSkills = () => {
    if (bio.trim().length < 20) { setError('Write at least 20 characters so people know what makes a good exchange with you.'); return; }
    setError(''); setStep(2);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!wantedSkills.length || !offeredSkills.length) { setError('Add at least one skill you want to learn and one you can share.'); return; }
    setSaving(true); setError('');
    try {
      const { data } = await api.put('/users/me', { bio: bio.trim(), skillsWanted: wantedSkills, skillsOffered: offeredSkills, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      dispatch(updateUser(data));
      navigate('/dashboard');
    } catch (err) { setError(err.response?.data?.message || 'We could not finish your profile. Please try again.'); }
    finally { setSaving(false); }
  };

  return <div className="onboarding-backdrop"><section className="onboarding-modal onboarding-v2" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" ref={dialogRef}>
    <div className="onboarding-step-indicator"><span className="active">01 Basics</span><hr/><span className={step === 2 ? 'active' : ''}>02 Skills</span></div>
    <form onSubmit={submit}>
      {step === 1 ? <div className="step-content animate-in"><p className="page-eyebrow">Set up your profile</p><h2 id="onboarding-title">Tell us about yourself.</h2><p>Give future exchange partners a useful, human introduction.</p><div className="onboarding-field"><label htmlFor="onboarding-bio">Your introduction</label><textarea id="onboarding-bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength="500" placeholder="I’m a product designer who loves teaching prototyping and wants to learn conversational Spanish…"/><small>{bio.length}/500</small></div>{error && <p className="onboarding-message error">{error}</p>}<button className="primary-button onboarding-next" type="button" onClick={continueToSkills}>Continue <Icon name="arrow" size={15}/></button></div>
      : <div className="step-content animate-in"><p className="page-eyebrow">Shape your exchange</p><h2 id="onboarding-title">What are you mastering?</h2><p>Use commas to separate skills. Specific skills make stronger matches.</p><SkillInput id="onboarding-wanted" label="I want to learn" value={wanted} onChange={setWanted} placeholder="Spanish, wheel pottery"/><SkillInput id="onboarding-offered" label="I can share" value={offered} onChange={setOffered} placeholder="Figma, product strategy"/>{error && <p className="onboarding-message error">{error}</p>}<div className="onboarding-actions-v2"><button className="ghost-button" type="button" onClick={() => { setError(''); setStep(1); }}>Back</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Building your workspace…' : 'Launch dashboard'}<Icon name="arrow" size={15}/></button></div></div>}
    </form>
  </section></div>;
}
