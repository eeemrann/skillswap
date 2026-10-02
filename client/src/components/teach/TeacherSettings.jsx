import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { errorMessage, formatCredits, idOf } from '../../lib/format';
import { TEACHER_TYPE_LABEL, TIER_LABEL, rateOptions } from '../../lib/teachers';
import { useToast } from '../../lib/toast';
import { updateUser } from '../../redux/authSlice';
import Icon from '../Icon';

/** What a verified teacher controls: the hourly price, which verified skills are listed, and the next steps to get paid. */
export default function TeacherSettings({ teaching, application, onRequestSkills, onChanged }) {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const toast = useToast();
  const [rate, setRate] = useState(teaching.hourlyRateCredits);
  const [skills, setSkills] = useState(teaching.skillsOffered);
  const [busy, setBusy] = useState(false);
  const dirty = Number(rate) !== teaching.hourlyRateCredits || [...skills].sort().join('|') !== [...teaching.skillsOffered].sort().join('|');
  const options = rateOptions({ min: teaching.rateMin, step: teaching.rateStep, cap: teaching.rateCap });

  const toggle = (skill) => setSkills((current) => (current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]));

  const save = async () => {
    setBusy(true);
    try {
      await api.patch('/teachers/me', { hourlyRateCredits: Number(rate), skillsOffered: skills });
      const profile = await api.get('/users/me');
      dispatch(updateUser(profile.data));
      toast.success('Teaching settings saved');
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, 'Your settings could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    { done: Boolean(user?.availability?.length), label: 'Add your weekly availability', to: '/settings', hint: 'Learners book times that fit your schedule.' },
    { done: Boolean(user?.hasPayoutAccount), label: 'Set up payouts', to: '/billing', hint: 'Stripe checks your identity and bank account once.' },
    { done: Boolean(user?.bio), label: 'Write your introduction', to: '/settings', hint: 'A friendly bio doubles your booking rate.' }
  ];

  return (
    <div className="stack" style={{ '--gap': '22px' }}>
      <section className="card card-pad stack" style={{ '--gap': '14px' }}>
        <div className="row spread">
          <div className="row" style={{ gap: 10 }}>
            <span className="verified-badge"><Icon name="checkCircle" size={14} /> {TIER_LABEL[teaching.tier] || 'Verified'} teacher</span>
            {application?.teacherType && <span className="badge">{TEACHER_TYPE_LABEL[application.teacherType]}</span>}
          </div>
          <Link className="btn btn-secondary btn-sm" to={`/profile/${idOf(user)}`}>View public profile <Icon name="external" size={13} /></Link>
        </div>
        <p className="muted">You are visible in Discover and learners can book you. Every session you finish adds credits to your wallet, minus the platform fee ({user?.limits?.serviceFeePct ?? 12}%{user?.effectivePlan === 'pro' ? ', Pro rate' : ''}).</p>
      </section>

      <section className="card card-pad stack" style={{ '--gap': '18px' }}>
        <h2 className="card-title">Price and skills</h2>
        <div className="field" style={{ maxWidth: 360 }}>
          <label htmlFor="ts-rate">Hourly rate</label>
          <select id="ts-rate" className="select" value={rate} onChange={(event) => setRate(Number(event.target.value))}>
            {options.map((value) => <option key={value} value={value}>{formatCredits(value)} {value === 1 ? 'credit' : 'credits'} per hour</option>)}
          </select>
          <span className="hint">Your limit is {teaching.rateCap} credits an hour{teaching.tier === 'standard' ? '. Experts with senior credentials can apply for a higher tier by contacting support.' : '.'} New prices apply to new requests only.</span>
        </div>
        <div className="field">
          <span className="label">Skills you list</span>
          <div className="tags">
            {teaching.verifiedSkills.map((skill) => (
              <button type="button" key={skill} className={`tag chip-button ${skills.includes(skill) ? 'brand' : ''}`} aria-pressed={skills.includes(skill)} onClick={() => toggle(skill)}>
                {skills.includes(skill) && <Icon name="check" size={12} />}{skill}
              </button>
            ))}
          </div>
          <span className="hint">Only skills a reviewer verified for you can be listed. Want more? <button type="button" className="link-button" onClick={onRequestSkills}>Request additional skills</button>.</span>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary" disabled={!dirty || busy || skills.length === 0} onClick={save}>{busy ? <span className="spinner" /> : 'Save changes'}</button>
        </div>
      </section>

      <section className="card card-pad stack" style={{ '--gap': '12px' }}>
        <h2 className="card-title">Get ready for your first booking</h2>
        <ul className="checklist" style={{ marginTop: 0 }}>
          {steps.map((step) => (
            <li key={step.label} className={step.done ? 'done' : ''}>
              <Icon name={step.done ? 'checkCircle' : 'clock'} size={16} />
              {step.done ? <span>{step.label}</span> : <span><Link to={step.to}>{step.label}</Link> <span className="faint">· {step.hint}</span></span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
