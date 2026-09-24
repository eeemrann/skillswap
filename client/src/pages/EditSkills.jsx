import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Icon from '../components/Icon';
import { updateUser } from '../redux/authSlice';

const splitSkills = (value) => [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
const parseAvailability = (text) => {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;
  const slots = [];
  const errors = [];
  text.split(',').map((item) => item.trim()).filter(Boolean).forEach((entry) => {
    const match = entry.match(/^(\w+)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
    if (!match) { errors.push(`Use “day HH:MM-HH:MM” for “${entry}”.`); return; }
    const [, rawDay, start, end] = match;
    const day = rawDay.toLowerCase();
    if (!days.includes(day)) { errors.push(`“${rawDay}” is not a valid day.`); return; }
    if (!validTime.test(start) || !validTime.test(end)) { errors.push(`Use 24-hour times for “${entry}”.`); return; }
    if (start >= end) { errors.push(`The end time must be later than the start time for “${entry}”.`); return; }
    slots.push({ day, start, end });
  });
  return { slots, errors };
};

function SettingsSection({ title, description, children }) {
  return <section className="settings-section"><div className="settings-info"><h3>{title}</h3><p>{description}</p></div><div className="settings-fields">{children}</div></section>;
}

export default function EditSkills() {
  const currentUser = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({ skillsOffered: '', skillsWanted: '', bio: '', city: '', country: '', timezone: 'UTC', availability: '' });
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get('/users/me').then(({ data: profile }) => {
      if (!active) return;
      setForm({ skillsOffered: (profile.skillsOffered || []).join(', '), skillsWanted: (profile.skillsWanted || []).join(', '), bio: profile.bio || '', city: profile.location?.city || '', country: profile.location?.country || '', timezone: profile.timezone || 'UTC', availability: (profile.availability || []).map((slot) => `${slot.day} ${slot.start}-${slot.end}`).join(', ') });
    }).catch(() => active && setMessage('Failed to load your profile.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const offered = useMemo(() => splitSkills(form.skillsOffered), [form.skillsOffered]);
  const wanted = useMemo(() => splitSkills(form.skillsWanted), [form.skillsWanted]);
  const completeness = Math.round(([form.bio.trim(), offered.length, wanted.length, form.city.trim(), form.availability.trim()].filter(Boolean).length / 5) * 100);
  const displayName = currentUser?.name || 'Your name';
  const previewInitials = displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    const { slots, errors } = parseAvailability(form.availability);
    if (errors.length) { setMessage(errors[0]); return; }
    setIsSaving(true);
    try {
      const { data } = await api.put('/users/me', { skillsOffered: offered, skillsWanted: wanted, bio: form.bio.trim(), timezone: form.timezone.trim() || 'UTC', location: { city: form.city.trim(), country: form.country.trim() }, availability: slots });
      dispatch(updateUser(data));
      setMessage('Expert profile published successfully.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Update failed. Check your profile details.');
    } finally { setIsSaving(false); }
  };

  const isError = /failed|valid|must|use |later than/i.test(message);

  return (
    <AppShell eyebrow="DOSSIER_CONFIG" title="Configuration" description="Build the technical identity that represents your expertise across the exchange.">
      <div className="settings-layout page-enter">
        <form className="configuration-form foundry-card foundry-configuration" onSubmit={handleSubmit} aria-busy={loading}>
          {message && <div className={`studio-message ${isError ? 'error' : 'success'}`} role="status"><span>{isError ? '!' : '✓'}</span>{message}</div>}

          <SettingsSection title="Professional Bio" description="Describe your expertise and what makes an exchange with you valuable.">
            <div className="input-group-premium"><label htmlFor="studio-bio">Public introduction</label><textarea id="studio-bio" className="foundry-input foundry-textarea" placeholder="I am a senior engineer specializing in system design..." value={form.bio} onChange={(event) => update('bio', event.target.value)} maxLength="500"/><small>{form.bio.length}/500 characters</small></div>
          </SettingsSection>

          <SettingsSection title="The Exchange" description="List the skills you are ready to mentor and those you want to acquire.">
            <div className="input-group-premium"><label htmlFor="studio-offered">I can teach</label><input id="studio-offered" className="foundry-input" value={form.skillsOffered} onChange={(event) => update('skillsOffered', event.target.value)} placeholder="React, Figma, leadership..."/><div className="studio-tags">{offered.map((skill) => <span key={skill}>{skill}</span>)}</div></div>
            <div className="input-group-premium"><label htmlFor="studio-wanted">I want to learn</label><input id="studio-wanted" className="foundry-input" value={form.skillsWanted} onChange={(event) => update('skillsWanted', event.target.value)} placeholder="Public speaking, Spanish..."/><div className="studio-tags wanted">{wanted.map((skill) => <span key={skill}>{skill}</span>)}</div></div>
          </SettingsSection>

          <SettingsSection title="Availability & Logistics" description="Set your location, timezone, and preferred exchange windows.">
            <div className="studio-columns"><div className="input-group-premium"><label htmlFor="studio-city">City</label><input id="studio-city" className="foundry-input" value={form.city} onChange={(event) => update('city', event.target.value)} placeholder="Dhaka"/></div><div className="input-group-premium"><label htmlFor="studio-country">Country</label><input id="studio-country" className="foundry-input" value={form.country} onChange={(event) => update('country', event.target.value)} placeholder="Bangladesh"/></div></div>
            <div className="input-group-premium"><label htmlFor="studio-timezone">Timezone</label><input id="studio-timezone" className="foundry-input" value={form.timezone} onChange={(event) => update('timezone', event.target.value)} placeholder="Asia/Dhaka"/></div>
            <div className="input-group-premium"><label htmlFor="studio-availability">Weekly schedule</label><input id="studio-availability" className="foundry-input" value={form.availability} onChange={(event) => update('availability', event.target.value)} placeholder="monday 09:00-11:00, wednesday 14:00-16:00"/><small>Format: day HH:MM-HH:MM, separated by commas.</small></div>
          </SettingsSection>

          <footer className="configuration-actions"><button type="submit" className="primary-button" disabled={isSaving || loading}>{isSaving ? 'Synchronizing…' : 'Save Profile Changes'}<Icon name="arrow" size={14}/></button><button type="button" className="secondary-button" onClick={() => navigate('/dashboard')}>Discard</button></footer>
        </form>

        <aside className="sticky-preview">
          <span className="preview-card-label">Live Expert Card</span>
          <article className="expert-card-foundry studio-preview-card">
            <div className="avatar-lg">{previewInitials || 'SS'}</div>
            <div className="expert-card-body"><h3>{displayName}</h3><p className="expert-card-meta">{[form.city, form.country].filter(Boolean).join(', ') || 'Global Location'} <span>•</span> Available Mentor</p><p className="expert-card-bio-glass">{form.bio || 'Your professional bio will preview here as you write it.'}</p></div>
            <div className="expert-card-skills">{offered.length ? offered.slice(0, 3).map((skill) => <span key={skill} className="skill-tag-glass">{skill}</span>) : <span className="skill-count-glass">Add your first skill</span>}</div>
          </article>
          <div className="studio-strength"><div><span>Profile strength</span><strong>{completeness}%</strong></div><div className="progress-bar-glass"><i className="progress-fill-glass" style={{ width: `${completeness}%` }}/></div><p><Icon name="spark" size={13}/> Specific skills and clear availability produce better matches.</p></div>
        </aside>
      </div>
    </AppShell>
  );
}
