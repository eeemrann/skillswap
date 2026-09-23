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
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  const slots = []; const errors = [];
  text.split(',').map((item) => item.trim()).filter(Boolean).forEach((entry) => {
    const match = entry.match(/^(\w+)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
    if (!match) { errors.push(`Use “day HH:MM-HH:MM” for “${entry}”.`); return; }
    const [, rawDay, start, end] = match;
    const day = rawDay.toLowerCase();
    if (!days.includes(day)) { errors.push(`“${rawDay}” is not a valid day.`); return; }
    if (!time.test(start) || !time.test(end)) { errors.push(`Use 24-hour times for “${entry}”.`); return; }
    if (start >= end) { errors.push(`The end time must be later than the start time for “${entry}”.`); return; }
    slots.push({ day, start, end });
  });
  return { slots, errors };
};

function SettingsSection({ number, title, description, children }) {
  return <section className="settings-section"><header><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></header><div className="settings-fields">{children}</div></section>;
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
  const profileCompleteness = Math.round(([form.bio.trim(), offered.length, wanted.length, form.city.trim(), form.availability.trim()].filter(Boolean).length / 5) * 100);

  const handleSubmit = async (event) => {
    event.preventDefault(); setMessage('');
    const { slots, errors } = parseAvailability(form.availability);
    if (errors.length) { setMessage(errors[0]); return; }
    setIsSaving(true);
    try {
      const { data } = await api.put('/users/me', { skillsOffered: offered, skillsWanted: wanted, bio: form.bio.trim(), timezone: form.timezone.trim() || 'UTC', location: { city: form.city.trim(), country: form.country.trim() }, availability: slots });
      dispatch(updateUser(data));
      setMessage('Profile updated successfully.');
    } catch (err) { setMessage(err.response?.data?.message || 'Update failed. Check your profile details.'); }
    finally { setIsSaving(false); }
  };

  const isError = /failed|valid|must|use /i.test(message);
  const displayName = currentUser?.name || 'Your name';

  return <AppShell eyebrow="Profile studio" title="Refine your persona." description="Configure how your expertise appears to the SkillSwap community.">
    <div className="persona-builder">
      <form className="persona-form page-enter" onSubmit={handleSubmit} aria-busy={loading}>
        {message && <p className={`studio-message ${isError ? 'error' : 'success'}`} role="status"><span>{isError ? '!' : '✓'}</span>{message}</p>}
        <SettingsSection number="01" title="Professional basics" description="Your public introduction. Keep it concise, specific, and human."><div className="input-group-premium"><label htmlFor="studio-bio">Professional bio</label><textarea id="studio-bio" className="studio-input" value={form.bio} onChange={(event) => update('bio', event.target.value)} placeholder="Describe what you teach, what you are learning, and how you like to collaborate…" maxLength="500"/><small>{form.bio.length}/500 characters</small></div></SettingsSection>
        <SettingsSection number="02" title="Expertise" description="These skills shape your directory profile and determine your strongest matches."><div className="input-group-premium"><label htmlFor="studio-offered">Skills you can teach</label><input id="studio-offered" className="studio-input" value={form.skillsOffered} onChange={(event) => update('skillsOffered', event.target.value)} placeholder="Product design, React, photography"/><div className="studio-tags">{offered.map((skill) => <span key={skill}>{skill}</span>)}</div></div><div className="input-group-premium"><label htmlFor="studio-wanted">Skills you want to learn</label><input id="studio-wanted" className="studio-input" value={form.skillsWanted} onChange={(event) => update('skillsWanted', event.target.value)} placeholder="Spanish, pottery, public speaking"/><div className="studio-tags wanted">{wanted.map((skill) => <span key={skill}>{skill}</span>)}</div></div></SettingsSection>
        <SettingsSection number="03" title="Location" description="Give nearby members useful context without sharing a precise address."><div className="studio-columns"><div className="input-group-premium"><label htmlFor="studio-city">City</label><input id="studio-city" className="studio-input" value={form.city} onChange={(event) => update('city', event.target.value)} placeholder="Dhaka"/></div><div className="input-group-premium"><label htmlFor="studio-country">Country</label><input id="studio-country" className="studio-input" value={form.country} onChange={(event) => update('country', event.target.value)} placeholder="Bangladesh"/></div></div><div className="input-group-premium"><label htmlFor="studio-timezone">Timezone</label><input id="studio-timezone" className="studio-input" value={form.timezone} onChange={(event) => update('timezone', event.target.value)} placeholder="Asia/Dhaka"/></div></SettingsSection>
        <SettingsSection number="04" title="Availability" description="Use 24-hour time so partners know when an exchange can fit."><div className="input-group-premium"><label htmlFor="studio-availability">Weekly schedule</label><input id="studio-availability" className="studio-input" value={form.availability} onChange={(event) => update('availability', event.target.value)} placeholder="monday 18:00-20:00, saturday 10:00-12:00"/><small>Format: day HH:MM-HH:MM, separated by commas.</small></div></SettingsSection>
        <footer className="studio-actions"><div><strong>Ready to publish?</strong><span>Your changes update your expert profile immediately.</span></div><div><button className="ghost-button" type="button" onClick={() => navigate('/dashboard')}>Cancel</button><button className="primary-button" type="submit" disabled={isSaving || loading}>{isSaving ? 'Saving changes…' : 'Save profile'}<Icon name="arrow" size={14}/></button></div></footer>
      </form>

      <aside className="persona-preview"><div className="preview-heading"><span>Public preview</span><small>Live</small></div><article className="persona-card"><div className="persona-card-top"><span className="persona-avatar">{displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><span className="persona-status"><i/> Available</span></div><p className="persona-label">Community expert</p><h2>{displayName}</h2><p className="persona-location">{[form.city, form.country].filter(Boolean).join(', ') || 'Location not set'}</p><p className="persona-bio">{form.bio || 'Your professional bio will appear here as you write it.'}</p><div className="persona-divider"/><small>Expertise</small><div className="persona-skills">{offered.length ? offered.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>) : <em>Add your first skill</em>}</div></article><div className="profile-strength"><div><span>Profile strength</span><strong>{profileCompleteness}%</strong></div><div><i style={{ width: `${profileCompleteness}%` }}/></div><p><Icon name="spark" size={13}/> Specific skills and clear availability produce better matches.</p></div></aside>
    </div>
  </AppShell>;
}
