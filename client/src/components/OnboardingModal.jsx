import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { updateUser } from '../redux/authSlice';
import Icon from './Icon';

const parseSkills = (value) => [...new Set(value.split(',').map((skill) => skill.trim()).filter(Boolean))];

function SkillEntry({ id, label, description, value, onChange, placeholder, tone }) {
  const skills = useMemo(() => parseSkills(value), [value]);
  const removeSkill = (skill) => onChange(skills.filter((item) => item !== skill).join(', '));

  return (
    <section className="onboarding-section">
      <div className={`onboarding-step ${tone}`}><Icon name={tone === 'learn' ? 'search' : 'spark'} size={17} /></div>
      <div className="onboarding-field">
        <label htmlFor={id}>{label}</label>
        <p>{description}</p>
        <input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" />
        {skills.length > 0 && <div className="onboarding-tags" aria-live="polite">{skills.map((skill) => <span key={skill}>{skill}<button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>&times;</button></span>)}</div>}
      </div>
    </section>
  );
}

function OnboardingModal() {
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const dialogRef = useRef(null);
  const [wanted, setWanted] = useState('');
  const [offered, setOffered] = useState('');
  const [dismissedFor, setDismissedFor] = useState(() => sessionStorage.getItem('skillswap-onboarding-skipped') || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const userId = user?.id || user?._id || '';
  const isAppRoute = !['/', '/login', '/register'].includes(location.pathname);
  const needsOnboarding = Boolean(token && userId && isAppRoute && (user.skillsOffered?.length || 0) === 0 && (user.skillsWanted?.length || 0) === 0 && dismissedFor !== userId);
  const wantedSkills = useMemo(() => parseSkills(wanted), [wanted]);
  const offeredSkills = useMemo(() => parseSkills(offered), [offered]);
  const progress = (wantedSkills.length ? 1 : 0) + (offeredSkills.length ? 1 : 0);

  useEffect(() => {
    if (!needsOnboarding) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => dialogRef.current?.querySelector('input')?.focus(), 180);
    return () => { document.body.style.overflow = previousOverflow; window.clearTimeout(focusTimer); };
  }, [needsOnboarding]);

  if (!needsOnboarding) return null;

  const skip = () => {
    sessionStorage.setItem('skillswap-onboarding-skipped', userId);
    setDismissedFor(userId);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!wantedSkills.length || !offeredSkills.length) { setError('Add at least one skill in each section to complete your profile.'); return; }
    setSaving(true); setError('');
    try {
      const response = await api.put('/users/me/skills', { skillsWanted: wantedSkills, skillsOffered: offeredSkills });
      sessionStorage.removeItem('skillswap-onboarding-skipped');
      setSuccess(true);
      window.setTimeout(() => {
        dispatch(updateUser(response.data));
        navigate('/dashboard');
      }, 700);
    } catch (err) {
      setError(err.response?.data?.message || 'We could not save your skills. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="onboarding-backdrop" role="presentation">
      <section className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" ref={dialogRef}>
        <div className="onboarding-accent" />
        <header className="onboarding-header">
          <div className="onboarding-icon"><Icon name="spark" size={22} /></div>
          <div className="onboarding-progress"><span>{progress} of 2 complete</span><div><i style={{ width: `${progress * 50}%` }} /></div></div>
          <h2 id="onboarding-title">Welcome to SkillSwap <span aria-hidden="true">👋</span></h2>
          <p>Tell us what you want to learn and what you can teach.</p>
        </header>
        <form onSubmit={submit}>
          <div className="onboarding-fields">
            <SkillEntry id="onboarding-wanted" tone="learn" label="What skills do you want to learn?" description="Add a comma after each skill to create your list." value={wanted} onChange={setWanted} placeholder="Programming, Guitar, Cooking, Spanish" />
            <SkillEntry id="onboarding-offered" tone="share" label="What skills can you share?" description="Everyday experience counts. Be specific." value={offered} onChange={setOffered} placeholder="Photography, Excel, Baking, Design" />
          </div>
          {error && <p className="onboarding-message error" role="alert">{error}</p>}
          {success && <p className="onboarding-message success" role="status">Your profile is ready. Let&apos;s find your first match!</p>}
          <footer className="onboarding-actions"><button className="ghost-button" type="button" onClick={skip} disabled={saving}>Skip for now</button><button className="primary-button" type="submit" disabled={saving || success}>{saving ? 'Saving your skills...' : success ? 'Profile completed' : 'Complete profile'}{!saving && !success && <Icon name="arrow" size={15} />}</button></footer>
        </form>
      </section>
    </div>
  );
}

export default OnboardingModal;
