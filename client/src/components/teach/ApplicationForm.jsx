import { useState } from 'react';
import api from '../../api/axios';
import { errorMessage } from '../../lib/format';
import { CREDENTIAL_KIND_LABEL, TEACHER_TYPE_HINT, TEACHER_TYPE_ICON, TEACHER_TYPE_LABEL, rateOptions } from '../../lib/teachers';
import { useToast } from '../../lib/toast';
import Icon from '../Icon';
import SkillPicker from '../SkillPicker';
import EmailVerify from './EmailVerify';

const blankCredential = () => ({ kind: 'degree', title: '', issuer: '', year: '', url: '' });
const blankLinks = { linkedin: '', github: '', website: '', institutionProfile: '' };

const fromApplication = (application) => ({
  teacherType: application?.teacherType || '',
  headline: application?.headline || '',
  statement: application?.statement || '',
  organization: application?.organization || '',
  jobTitle: application?.jobTitle || '',
  yearsExperience: application?.yearsExperience ? String(application.yearsExperience) : '',
  skills: application?.skills || [],
  proposedRateCredits: application?.proposedRateCredits ?? 1,
  credentials: application?.credentials?.length ? application.credentials.map((item) => ({ kind: item.kind, title: item.title, issuer: item.issuer, year: item.year ? String(item.year) : '', url: item.url || '' })) : [blankCredential()],
  links: { ...blankLinks, ...(application?.links || {}) },
  institutionalEmail: application?.institutionalEmail || ''
});

function Section({ number, title, description, children }) {
  return (
    <section className="card card-pad stack" style={{ '--gap': '18px' }}>
      <header className="row nowrap" style={{ alignItems: 'flex-start', gap: 14 }}>
        <span className="step-dot" aria-hidden="true">{number}</span>
        <div className="stack" style={{ '--gap': '3px' }}><h2 className="card-title">{title}</h2>{description && <p className="small muted">{description}</p>}</div>
      </header>
      {children}
    </section>
  );
}

const LABELS = {
  university_lecturer: { organization: 'University or institute', jobTitle: 'Academic title', orgPlaceholder: 'University of Dhaka', titlePlaceholder: 'Senior Lecturer, Computer Science' },
  industry_professional: { organization: 'Employer or company', jobTitle: 'Job title', orgPlaceholder: 'Acme Cloud Ltd', titlePlaceholder: 'Staff Software Engineer' },
  certified_trainer: { organization: 'Training company (optional)', jobTitle: 'Role (optional)', orgPlaceholder: 'Cloud Academy', titlePlaceholder: 'Authorised AWS trainer' },
  independent_expert: { organization: 'Company or project (optional)', jobTitle: 'Role (optional)', orgPlaceholder: 'Freelance · OSS maintainer', titlePlaceholder: 'Maintainer of a popular library' }
};

/**
 * The teacher application. Everything a reviewer needs to judge a person is collected here:
 * how they qualify, proof they can show, places to check them, and a mailbox they control.
 */
export default function ApplicationForm({ rules, application, mode = 'apply', emailVerified = false, onSubmitted, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState(() => fromApplication(application));
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const setLink = (key) => (event) => setForm((current) => ({ ...current, links: { ...current.links, [key]: event.target.value } }));
  const setCredential = (index, patch) => setForm((current) => ({ ...current, credentials: current.credentials.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));
  const labels = LABELS[form.teacherType] || LABELS.industry_professional;
  const rates = rateOptions({ min: rules.rateMin, step: rules.rateStep, cap: rules.rateCaps.expert });

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...form,
        yearsExperience: Number(form.yearsExperience),
        proposedRateCredits: Number(form.proposedRateCredits),
        credentials: form.credentials.map((item) => ({ ...item, year: item.year ? Number(item.year) : undefined }))
      };
      const { data } = await api.put('/teachers/application', payload);
      toast.success(mode === 'expand' ? 'Your request was sent for review.' : 'Application submitted. We will review it shortly.');
      onSubmitted(data);
    } catch (err) {
      setError(errorMessage(err, 'We could not submit your application.'));
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack" style={{ '--gap': '20px' }} onSubmit={submit}>
      {mode === 'apply' && (
        <Section number="1" title="How do you qualify to teach?" description="Choose the closest match. We verify every applicant by hand before anyone can book them.">
          <div className="type-grid" role="radiogroup" aria-label="How you qualify">
            {Object.keys(TEACHER_TYPE_LABEL).map((key) => (
              <button type="button" role="radio" aria-checked={form.teacherType === key} key={key} className="type-card" onClick={() => set('teacherType')(key)}>
                <span className="type-icon"><Icon name={TEACHER_TYPE_ICON[key]} size={20} /></span>
                <span className="stack" style={{ '--gap': '2px' }}><strong>{TEACHER_TYPE_LABEL[key]}</strong><span className="small muted">{TEACHER_TYPE_HINT[key]}</span></span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {mode === 'apply' && (
        <Section number="2" title="Your experience" description="This is what learners read before they book you.">
          <div className="field">
            <label htmlFor="ta-headline">Headline</label>
            <input id="ta-headline" className="input" value={form.headline} maxLength={120} onChange={(event) => set('headline')(event.target.value)} placeholder="Senior backend engineer teaching Go and system design" required />
            <span className="counter">{form.headline.length}/120</span>
          </div>
          <div className="grid cols-2">
            <div className="field"><label htmlFor="ta-org">{labels.organization}</label><input id="ta-org" className="input" value={form.organization} maxLength={120} onChange={(event) => set('organization')(event.target.value)} placeholder={labels.orgPlaceholder} /></div>
            <div className="field"><label htmlFor="ta-title">{labels.jobTitle}</label><input id="ta-title" className="input" value={form.jobTitle} maxLength={120} onChange={(event) => set('jobTitle')(event.target.value)} placeholder={labels.titlePlaceholder} /></div>
          </div>
          <div className="field" style={{ maxWidth: 220 }}>
            <label htmlFor="ta-years">Years of professional experience</label>
            <input id="ta-years" className="input" type="number" min="1" max="60" value={form.yearsExperience} onChange={(event) => set('yearsExperience')(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="ta-statement">Your teaching or mentoring experience</label>
            <textarea id="ta-statement" className="textarea" rows={5} maxLength={1500} value={form.statement} onChange={(event) => set('statement')(event.target.value)} required
              placeholder="Who have you taught or mentored, and how? What can a learner expect from a session with you?" />
            <span className="counter">{form.statement.length}/1500</span>
          </div>
        </Section>
      )}

      <Section number={mode === 'apply' ? '3' : '1'} title={mode === 'apply' ? 'What will you teach, and for how much?' : 'Which skills do you want to add?'} description="Only technology skills from our catalog. You can teach up to 10 skills per application.">
        <SkillPicker label="Skills" value={form.skills} onChange={set('skills')} max={10} hint="Be honest: reviewers check each skill against your proof below." />
        {mode === 'apply' && (
          <div className="field" style={{ maxWidth: 360 }}>
            <label htmlFor="ta-rate">Your hourly rate</label>
            <select id="ta-rate" className="select" value={form.proposedRateCredits} onChange={(event) => set('proposedRateCredits')(Number(event.target.value))}>
              {rates.map((rate) => <option key={rate} value={rate}>{rate} {rate === 1 ? 'credit' : 'credits'} per hour</option>)}
            </select>
            <span className="hint">Verified teachers can charge up to {rules.rateCaps.standard} credits an hour, Experts up to {rules.rateCaps.expert}. A reviewer sets your tier, so a rate above {rules.rateCaps.standard} is only possible for experts.</span>
          </div>
        )}
      </Section>

      <Section number={mode === 'apply' ? '4' : '2'} title="Proof of your expertise" description="List degrees, certifications, roles or published work. A link a reviewer can open speeds approval a lot.">
        <div className="stack" style={{ '--gap': '12px' }}>
          {form.credentials.map((item, index) => (
            <div className="cred-card" key={index}>
              <div className="grid cols-2">
                <div className="field"><label htmlFor={`cr-kind-${index}`}>Type</label>
                  <select id={`cr-kind-${index}`} className="select" value={item.kind} onChange={(event) => setCredential(index, { kind: event.target.value })}>
                    {Object.entries(CREDENTIAL_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select></div>
                <div className="field"><label htmlFor={`cr-title-${index}`}>Title</label><input id={`cr-title-${index}`} className="input" value={item.title} maxLength={140} onChange={(event) => setCredential(index, { title: event.target.value })} placeholder="MSc Computer Science · AWS Solutions Architect" /></div>
                <div className="field"><label htmlFor={`cr-issuer-${index}`}>Issued by</label><input id={`cr-issuer-${index}`} className="input" value={item.issuer} maxLength={140} onChange={(event) => setCredential(index, { issuer: event.target.value })} placeholder="University, company or vendor" /></div>
                <div className="field"><label htmlFor={`cr-year-${index}`}>Year <span className="faint">(optional)</span></label><input id={`cr-year-${index}`} className="input" type="number" min="1950" max={new Date().getFullYear() + 1} value={item.year} onChange={(event) => setCredential(index, { year: event.target.value })} /></div>
              </div>
              <div className="field"><label htmlFor={`cr-url-${index}`}>Link to verify it <span className="faint">(optional, but it helps)</span></label><input id={`cr-url-${index}`} className="input" value={item.url} maxLength={500} onChange={(event) => setCredential(index, { url: event.target.value })} placeholder="https://www.credly.com/badges/…" /></div>
              {form.credentials.length > 1 && <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setForm((current) => ({ ...current, credentials: current.credentials.filter((_, i) => i !== index) }))}><Icon name="trash" size={14} /> Remove</button>}
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} disabled={form.credentials.length >= 8} onClick={() => setForm((current) => ({ ...current, credentials: [...current.credentials, blankCredential()] }))}><Icon name="plus" size={14} /> Add another</button>
        </div>
      </Section>

      <Section number={mode === 'apply' ? '5' : '3'} title="Where can we verify you?" description="Add at least one place that shows you are who you say you are. Reviewers open these links.">
        <div className="grid cols-2">
          <div className="field"><label htmlFor="ln-linkedin">LinkedIn</label><input id="ln-linkedin" className="input" value={form.links.linkedin} onChange={setLink('linkedin')} placeholder="linkedin.com/in/you" /></div>
          <div className="field"><label htmlFor="ln-github">GitHub</label><input id="ln-github" className="input" value={form.links.github} onChange={setLink('github')} placeholder="github.com/you" /></div>
          <div className="field"><label htmlFor="ln-staff">University staff or faculty page</label><input id="ln-staff" className="input" value={form.links.institutionProfile} onChange={setLink('institutionProfile')} placeholder="https://cse.university.edu/people/you" /></div>
          <div className="field"><label htmlFor="ln-site">Personal website or portfolio</label><input id="ln-site" className="input" value={form.links.website} onChange={setLink('website')} placeholder="https://you.dev" /></div>
        </div>
        <EmailVerify email={form.institutionalEmail} onChange={set('institutionalEmail')} initiallyVerified={emailVerified} />
      </Section>

      <section className="card card-pad stack" style={{ '--gap': '14px' }}>
        <label className="check-row">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span className="small">I confirm everything above is accurate, and I agree that SkillSwap may check my credentials and contact the issuers. I understand that misrepresenting qualifications ends my access and any pending payouts may be held.</span>
        </label>
        {error && <p className="alert error" role="alert">{error}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !consent || (mode === 'apply' && !form.teacherType) || form.skills.length === 0}>
            {busy ? <span className="spinner" /> : mode === 'expand' ? 'Request these skills' : 'Submit for verification'}
          </button>
        </div>
      </section>
    </form>
  );
}
