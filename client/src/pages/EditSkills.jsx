import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';

function EditSkills() {
  const [skillsOffered, setSkillsOffered] = useState('');
  const [skillsWanted, setSkillsWanted] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { let cancelled = false; const loadProfile = async () => { try { const res = await api.get('/users/me'); if (!cancelled) { setSkillsOffered((res.data.skillsOffered || []).join(', ')); setSkillsWanted((res.data.skillsWanted || []).join(', ')); } } catch { if (!cancelled) setMessage('Failed to load profile'); } }; loadProfile(); return () => { cancelled = true; }; }, []);
  const handleSubmit = async (event) => { event.preventDefault(); setMessage(''); setIsSaving(true); try { const offeredArray = skillsOffered.split(',').map((skill) => skill.trim()).filter(Boolean); const wantedArray = skillsWanted.split(',').map((skill) => skill.trim()).filter(Boolean); await api.put('/users/me/skills', { skillsOffered: offeredArray, skillsWanted: wantedArray }); setMessage('Skills updated!'); setTimeout(() => navigate('/dashboard'), 1000); } catch (err) { setMessage(err.response?.data?.message || 'Update failed'); } finally { setIsSaving(false); } };

  return <AppShell eyebrow="Your skill profile" title="Shape your exchange." description="Tell the community what you can share and what you are excited to learn next."><div className="surface form-card"><p className="section-kicker">Two sides of your profile</p>{message && <p className="status-message">{message}</p>}<form onSubmit={handleSubmit}><div className="form-field"><label htmlFor="skills-offered">Skills I can teach</label><input id="skills-offered" type="text" value={skillsOffered} onChange={(event) => setSkillsOffered(event.target.value)} placeholder="Guitar, Excel, Cooking" /><span className="form-hint">Separate skills with commas. Be specific and practical.</span></div><div className="form-field"><label htmlFor="skills-wanted">Skills I want to learn</label><input id="skills-wanted" type="text" value={skillsWanted} onChange={(event) => setSkillsWanted(event.target.value)} placeholder="Spanish, Photography" /><span className="form-hint">What would make your week feel a little richer?</span></div><div className="stack-actions"><button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save skill profile'} <span>→</span></button><button className="secondary-button" type="button" onClick={() => navigate('/dashboard')}>Cancel</button></div></form></div></AppShell>;
}

export default EditSkills;
