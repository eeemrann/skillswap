import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import TagInput from '../components/TagInput';
import { capitalize, errorMessage, SKILL_SUGGESTIONS, WEEKDAYS } from '../lib/format';
import { useToast } from '../lib/toast';
import { logout, updateUser } from '../redux/authSlice';

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Hindi', 'Bangla', 'Arabic', 'Mandarin', 'Japanese'];
const PRESETS = [
  ['Weekday evenings', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => ({ day, start: '18:00', end: '21:00' }))],
  ['Weekend mornings', ['saturday', 'sunday'].map((day) => ({ day, start: '09:00', end: '12:00' }))]
];

const timezones = () => {
  const current = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return all.includes(current) ? all : [current, ...all];
};

const initialForm = (user) => ({
  bio: user?.bio || '',
  languages: user?.languages || [],
  skillsOffered: user?.skillsOffered || [],
  skillsWanted: user?.skillsWanted || [],
  timezone: user?.timezone && user.timezone !== 'UTC' ? user.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone,
  availability: user?.availability || [],
  city: user?.location?.city || '',
  country: user?.location?.country || ''
});

function Section({ title, description, children }) {
  return (
    <section className="card card-pad settings-section">
      <header className="stack" style={{ '--gap': '4px' }}><h2 className="card-title">{title}</h2>{description && <p className="small muted">{description}</p>}</header>
      <div className="stack" style={{ '--gap': '18px' }}>{children}</div>
    </section>
  );
}

export default function Settings() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { openUserProfile, signOut } = useClerk();
  const [form, setForm] = useState(() => initialForm(user));
  const [saved, setSaved] = useState(() => JSON.stringify(initialForm(user)));
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const zones = useMemo(() => timezones(), []);
  const dirty = JSON.stringify(form) !== saved;
  const hasCoordinates = Array.isArray(user?.location?.coordinates) && user.location.coordinates.length === 2;
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const slotProblem = form.availability.find((slot) => !slot.start || !slot.end || slot.start >= slot.end);

  const save = async (event) => {
    event.preventDefault();
    if (slotProblem) { toast.error('Each availability slot needs an end time after its start time.'); return; }
    setSaving(true);
    try {
      const { data } = await api.put('/users/me', {
        bio: form.bio, languages: form.languages, skillsOffered: form.skillsOffered, skillsWanted: form.skillsWanted,
        timezone: form.timezone, availability: form.availability, location: { city: form.city, country: form.country }
      });
      dispatch(updateUser(data));
      setSaved(JSON.stringify(form));
      toast.success('Profile saved');
    } catch (error) {
      toast.error(errorMessage(error, 'Your profile could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const updateSlot = (index, patch) => setForm((current) => ({ ...current, availability: current.availability.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)) }));
  const addSlot = () => setForm((current) => ({ ...current, availability: [...current.availability, { day: 'monday', start: '18:00', end: '19:00' }] }));
  const removeSlot = (index) => setForm((current) => ({ ...current, availability: current.availability.filter((_, i) => i !== index) }));

  const useMyLocation = () => {
    if (!navigator.geolocation) { toast.error('Your browser does not support location.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await api.patch('/users/me/location', { longitude: coords.longitude, latitude: coords.latitude });
          const { data } = await api.get('/users/me');
          dispatch(updateUser(data));
          toast.success('Location saved. It is only used to rank nearby members.');
        } catch (error) { toast.error(errorMessage(error, 'Location could not be saved.')); } finally { setLocating(false); }
      },
      () => { setLocating(false); toast.error('Location permission was denied.'); },
      { timeout: 10000 }
    );
  };

  const removeLocation = async () => {
    try {
      await api.delete('/users/me/location');
      const { data } = await api.get('/users/me');
      dispatch(updateUser(data));
      setForm((current) => ({ ...current, city: '', country: '' }));
      setSaved((current) => JSON.stringify({ ...JSON.parse(current), city: '', country: '' }));
      toast.success('Location removed');
    } catch (error) { toast.error(errorMessage(error, 'Location could not be removed.')); }
  };

  const exportData = async () => {
    try {
      const { data } = await api.get('/users/me/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = Object.assign(document.createElement('a'), { href: url, download: 'skillswap-data.json' });
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) { toast.error(errorMessage(error, 'Export failed.')); }
  };

  const deleteAccount = async () => {
    try {
      await api.delete('/users/me');
      dispatch(logout());
      await signOut({ redirectUrl: '/' });
      navigate('/');
    } catch (error) { toast.error(errorMessage(error, 'Your account could not be deleted.')); }
  };

  return (
    <AppShell eyebrow="Profile" title="Your profile & settings" description="This is what other members see when they find you in Discover.">
      <form className="settings" onSubmit={save}>
        <Section title="About you" description="A good introduction helps people decide to book you.">
          <div className="field">
            <label htmlFor="bio">Introduction</label>
            <textarea id="bio" className="textarea" rows={5} maxLength={500} value={form.bio} onChange={(event) => set('bio')(event.target.value)} placeholder="What do you do, what do you enjoy teaching, and what would you like to learn?" />
            <span className="counter">{form.bio.length}/500</span>
          </div>
          <TagInput label="Languages you speak" value={form.languages} onChange={set('languages')} placeholder="English, Spanish…" suggestions={LANGUAGES} max={8} maxLength={40} />
        </Section>

        <Section title="Skills" description="Matching is based on these. Be specific: “conversational Spanish” beats “languages”.">
          <TagInput label="I can teach" value={form.skillsOffered} onChange={set('skillsOffered')} placeholder="Add a skill and press Enter" suggestions={SKILL_SUGGESTIONS} />
          <TagInput label="I want to learn" value={form.skillsWanted} onChange={set('skillsWanted')} placeholder="Add a skill and press Enter" suggestions={SKILL_SUGGESTIONS} />
        </Section>

        <Section title="Availability" description="When are you usually free for live sessions? Times are in your timezone and converted for everyone else.">
          <div className="field" style={{ maxWidth: 360 }}>
            <label htmlFor="tz">Your timezone</label>
            <select id="tz" className="select" value={form.timezone} onChange={(event) => set('timezone')(event.target.value)}>{zones.map((zone) => <option key={zone}>{zone}</option>)}</select>
          </div>
          <div className="stack" style={{ '--gap': '10px' }}>
            {form.availability.length === 0 && <p className="small muted">No availability yet. Add slots so matching can find overlaps.</p>}
            {form.availability.map((slot, index) => {
              const invalid = !slot.start || !slot.end || slot.start >= slot.end;
              return (
                <div className="slot" key={index}>
                  <select className="select" value={slot.day} onChange={(event) => updateSlot(index, { day: event.target.value })} aria-label="Day">{WEEKDAYS.map((day) => <option key={day} value={day}>{capitalize(day)}</option>)}</select>
                  <input className="input" type="time" value={slot.start} onChange={(event) => updateSlot(index, { start: event.target.value })} aria-label="From" aria-invalid={invalid} />
                  <span className="muted">to</span>
                  <input className="input" type="time" value={slot.end} onChange={(event) => updateSlot(index, { end: event.target.value })} aria-label="Until" aria-invalid={invalid} />
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => removeSlot(index)} aria-label="Remove slot"><Icon name="trash" size={16} /></button>
                </div>
              );
            })}
            <div className="row">
              <button type="button" className="btn btn-secondary btn-sm" onClick={addSlot} disabled={form.availability.length >= 35}><Icon name="plus" size={14} /> Add a time slot</button>
              {PRESETS.map(([label, slots]) => <button type="button" className="btn btn-ghost btn-sm" key={label} onClick={() => setForm((current) => ({ ...current, availability: [...current.availability, ...slots].slice(0, 35) }))}>+ {label}</button>)}
            </div>
          </div>
        </Section>

        <Section title="Location (optional)" description="Sessions are always online. Location only helps people find teachers nearby, and exact coordinates are never shown to anyone.">
          <div className="grid cols-2">
            <div className="field"><label htmlFor="city">City</label><input id="city" className="input" value={form.city} onChange={(event) => set('city')(event.target.value)} maxLength={100} placeholder="Dhaka" autoComplete="address-level2" /></div>
            <div className="field"><label htmlFor="country">Country</label><input id="country" className="input" value={form.country} onChange={(event) => set('country')(event.target.value)} maxLength={100} placeholder="Bangladesh" autoComplete="country-name" /></div>
          </div>
          <div className="row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={useMyLocation} disabled={locating}>{locating ? <span className="spinner" /> : <Icon name="pin" size={14} />} {hasCoordinates ? 'Update my location' : 'Use my current location'}</button>
            {(hasCoordinates || user?.location?.city) && <button type="button" className="btn btn-ghost btn-sm" onClick={removeLocation}>Remove location</button>}
            {hasCoordinates && <span className="badge success"><Icon name="check" size={11} /> Location on</span>}
          </div>
        </Section>

        <div className="save-bar" role="region" aria-label="Save changes">
          <span className="small muted">{dirty ? 'You have unsaved changes' : 'All changes saved'}</span>
          <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>{saving ? <span className="spinner" /> : 'Save changes'}</button>
        </div>
      </form>

      <Section title="Account" description="Sign-in, email and security are managed through your account portal.">
        <div className="row">
          <button type="button" className="btn btn-secondary" onClick={() => openUserProfile()}><Icon name="lock" size={15} /> Manage sign-in & security</button>
          <button type="button" className="btn btn-secondary" onClick={exportData}><Icon name="download" size={15} /> Download my data</button>
          <button type="button" className="btn btn-danger" onClick={() => setDeleting(true)}><Icon name="trash" size={15} /> Delete account</button>
        </div>
      </Section>

      <Modal open={deleting} onClose={() => setDeleting(false)} title="Delete your account?" description="This permanently removes your profile, messages and notifications and cancels any subscription. Unused credits are lost. This cannot be undone.">
        <div className="stack" style={{ '--gap': '14px' }}>
          <div className="field"><label htmlFor="confirm-delete">Type DELETE to confirm</label><input id="confirm-delete" className="input" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} autoComplete="off" /></div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setDeleting(false)}>Keep my account</button>
            <button type="button" className="btn btn-danger" disabled={confirmText !== 'DELETE'} onClick={deleteAccount}>Delete forever</button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
