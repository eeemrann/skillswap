import { useState } from 'react';
import api from '../../api/axios';
import { errorMessage, formatCredits, formatDate } from '../../lib/format';
import { useQuery } from '../../lib/hooks';
import { CREDENTIAL_KIND_LABEL, TEACHER_TYPE_LABEL, TIER_LABEL, rateOptions } from '../../lib/teachers';
import { useToast } from '../../lib/toast';
import Avatar from '../Avatar';
import EmptyState from '../EmptyState';
import Icon from '../Icon';
import Modal from '../Modal';

const STATUSES = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['revoked', 'Revoked']];
const RATE_CAPS = { standard: 3, expert: 8 };

const safeLink = (value) => /^https?:\/\//i.test(value || '') ? value : '';
const hostOf = (value) => { try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return value; } };

function Evidence({ application }) {
  const links = Object.entries(application.links || {}).filter(([, value]) => safeLink(value));
  const { signals } = application;
  return (
    <div className="stack" style={{ '--gap': '12px' }}>
      <div className="row" style={{ gap: 6 }}>
        {application.institutionalEmail && (
          <span className={`badge ${signals.institutionalEmailVerified ? 'success' : 'warning'}`}>
            <Icon name={signals.institutionalEmailVerified ? 'checkCircle' : 'alert'} size={12} /> {application.institutionalEmail} {signals.institutionalEmailVerified ? 'verified' : 'NOT verified'}
          </span>
        )}
        {signals.academicEmail && <span className="badge brand">Academic domain</span>}
        {!application.institutionalEmail && <span className="badge">No institutional email</span>}
        <span className="badge">{signals.verifiableCredentials}/{application.credentials.length} credentials with a link</span>
      </div>
      <ul className="stack small" style={{ '--gap': '6px' }}>
        {application.credentials.map((item, index) => (
          <li key={index}><Icon name="check" size={13} /> <strong>{CREDENTIAL_KIND_LABEL[item.kind]}</strong>: {item.title}, {item.issuer}{item.year ? ` (${item.year})` : ''}{item.credentialId ? ` · ID ${item.credentialId}` : ''}
            {safeLink(item.url) && <> · <a href={item.url} target="_blank" rel="noreferrer noopener">{hostOf(item.url)} <Icon name="external" size={11} /></a></>}</li>
        ))}
      </ul>
      {links.length > 0 && <div className="row small" style={{ gap: 14 }}>{links.map(([key, value]) => <a key={key} href={value} target="_blank" rel="noreferrer noopener">{key === 'institutionProfile' ? 'Staff page' : key[0].toUpperCase() + key.slice(1)}: {hostOf(value)} <Icon name="external" size={11} /></a>)}</div>}
    </div>
  );
}

function ApproveDialog({ application, onClose, onDone }) {
  const toast = useToast();
  const [skills, setSkills] = useState(application.skills);
  const [tier, setTier] = useState('standard');
  const [rate, setRate] = useState(Math.min(application.proposedRateCredits, RATE_CAPS.standard));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const options = rateOptions({ cap: RATE_CAPS[tier] });
  const changeTier = (value) => { setTier(value); setRate((current) => Math.min(current, RATE_CAPS[value])); if (value === 'expert') setRate(application.proposedRateCredits); };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post(`/admin/teacher-applications/${application._id}/approve`, { skills, tier, rateCredits: Number(rate), notes });
      toast.success(`${application.user?.name || 'Applicant'} is now a verified teacher`);
      onDone();
    } catch (error) {
      toast.error(errorMessage(error, 'Approval failed.'));
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Approve teacher" description="Only the skills you tick will be bookable. You are vouching for these.">
      <form className="stack" style={{ '--gap': '16px' }} onSubmit={submit}>
        <div className="field"><span className="label">Verified skills</span>
          <div className="tags">{application.skills.map((skill) => (
            <button type="button" key={skill} className={`tag chip-button ${skills.includes(skill) ? 'brand' : ''}`} aria-pressed={skills.includes(skill)} onClick={() => setSkills((current) => (current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]))}>{skills.includes(skill) && <Icon name="check" size={12} />}{skill}</button>
          ))}</div></div>
        <div className="grid cols-2">
          <div className="field"><label htmlFor="ap-tier">Tier</label>
            <select id="ap-tier" className="select" value={tier} onChange={(event) => changeTier(event.target.value)}>{Object.entries(TIER_LABEL).map(([value, label]) => <option key={value} value={value}>{label} (up to {RATE_CAPS[value]} cr/h)</option>)}</select></div>
          <div className="field"><label htmlFor="ap-rate">Hourly rate</label>
            <select id="ap-rate" className="select" value={rate} onChange={(event) => setRate(Number(event.target.value))}>{options.map((value) => <option key={value} value={value}>{formatCredits(value)} credits/h</option>)}</select>
            <span className="hint">They asked for {formatCredits(application.proposedRateCredits)}.</span></div>
        </div>
        <div className="field"><label htmlFor="ap-notes">Internal notes <span className="faint">(not shown to the applicant)</span></label><textarea id="ap-notes" className="textarea" rows={3} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What did you check?" /></div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-success" disabled={busy || skills.length === 0}>{busy ? <span className="spinner" /> : 'Approve and publish'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ReasonDialog({ title, description, label, action, confirm, tone = 'btn-danger', onClose, onDone, successMessage }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try { await action(reason); toast.success(successMessage); onDone(); } catch (error) { toast.error(errorMessage(error, 'That did not work.')); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={title} description={description}>
      <form className="stack" style={{ '--gap': '14px' }} onSubmit={submit}>
        <div className="field"><label htmlFor="reason">{label}</label><textarea id="reason" className="textarea" rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} required minLength={10} /></div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className={`btn ${tone}`} disabled={busy || reason.trim().length < 10}>{busy ? <span className="spinner" /> : confirm}</button>
        </div>
      </form>
    </Modal>
  );
}

/** The verification queue: read the evidence, then approve with a tier and price, reject with feedback, or revoke later. */
export default function TeacherReviews({ onChanged }) {
  const [status, setStatus] = useState('pending');
  const [dialog, setDialog] = useState(null);
  const [open, setOpen] = useState('');
  const list = useQuery(() => api.get('/admin/teacher-applications', { params: { status, limit: 50 } }).then((r) => r.data), [status], { interval: 30000 });
  const done = () => { setDialog(null); list.reload(); onChanged?.(); };

  return (
    <div className="stack" style={{ '--gap': '16px' }}>
      <div className="tabs" role="tablist">{STATUSES.map(([key, label]) => <button type="button" role="tab" className="tab" key={key} aria-selected={status === key} onClick={() => setStatus(key)}>{label}</button>)}</div>
      {list.loading ? <div className="skeleton" style={{ height: 180 }} /> : !list.data?.length ? <div className="card"><EmptyState icon="shield" title={status === 'pending' ? 'No applications waiting' : 'Nothing here'}>{status === 'pending' ? 'New applications show up here as soon as they are submitted.' : 'Applications with this status will be listed here.'}</EmptyState></div> : (
        <div className="stack" style={{ '--gap': '14px' }}>
          {list.data.map((application) => (
            <article className="card card-pad stack" style={{ '--gap': '14px' }} key={application._id}>
              <header className="row spread nowrap" style={{ alignItems: 'flex-start' }}>
                <div className="row nowrap" style={{ alignItems: 'flex-start' }}>
                  <Avatar name={application.user?.name} src={application.user?.profilePicture} size="lg" />
                  <div className="stack" style={{ '--gap': '2px' }}>
                    <strong>{application.user?.name || 'Deleted member'}</strong>
                    <span className="small muted">{application.user?.email} · member since {application.user?.createdAt ? formatDate(application.user.createdAt, { month: 'short', year: 'numeric' }) : '?'}</span>
                    <span className="row" style={{ gap: 6 }}><span className="badge">{TEACHER_TYPE_LABEL[application.teacherType]}</span><span className="badge">{application.yearsExperience} yrs</span><span className="badge credit">asks {formatCredits(application.proposedRateCredits)} cr/h</span></span>
                  </div>
                </div>
                <span className="tiny faint nowrap-cell">Submitted {formatDate(application.submittedAt)}</span>
              </header>

              <div className="stack" style={{ '--gap': '6px' }}>
                <strong>{application.headline}</strong>
                {(application.organization || application.jobTitle) && <span className="small muted">{[application.jobTitle, application.organization].filter(Boolean).join(' · ')}</span>}
                <p className={`small muted prose ${open === application._id ? '' : 'clamp-3'}`}>{application.statement}</p>
                {application.statement.length > 220 && <button type="button" className="link-button small" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(open === application._id ? '' : application._id)}>{open === application._id ? 'Show less' : 'Read more'}</button>}
                <div className="tags">{application.skills.map((skill) => <span className="tag brand" key={skill}>{skill}</span>)}</div>
              </div>

              <Evidence application={application} />

              {application.status !== 'pending' && (
                <p className="small muted">
                  {application.status === 'approved' ? `Approved: ${application.approvedSkills.join(', ')} · ${TIER_LABEL[application.tier]}` : application.decisionReason}
                  {application.reviewNotes && <span className="faint"> · Notes: {application.reviewNotes}</span>}
                </p>
              )}

              <div className="row" style={{ justifyContent: 'flex-end' }}>
                {application.status === 'pending' && <>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => setDialog({ type: 'reject', application })}>Reject</button>
                  <button type="button" className="btn btn-success btn-sm" onClick={() => setDialog({ type: 'approve', application })}><Icon name="check" size={14} /> Approve</button>
                </>}
                {application.status === 'approved' && application.user?.teacherStatus === 'approved' && <button type="button" className="btn btn-danger btn-sm" onClick={() => setDialog({ type: 'revoke', application })}>Revoke access</button>}
              </div>
            </article>
          ))}
        </div>
      )}

      {dialog?.type === 'approve' && <ApproveDialog application={dialog.application} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.type === 'reject' && (
        <ReasonDialog title="Ask for changes" description="The applicant sees this message and can fix their application and apply again." label="What should they fix or add?" confirm="Send decision" onClose={() => setDialog(null)} onDone={done}
          successMessage="Applicant notified" action={(reason) => api.post(`/admin/teacher-applications/${dialog.application._id}/reject`, { reason })} />
      )}
      {dialog?.type === 'revoke' && (
        <ReasonDialog title="Revoke teacher access?" description="They disappear from Discover, upcoming sessions are cancelled and learners get their credits back. Earned credits stay in their wallet." label="Reason (shown to the teacher)" confirm="Revoke access" onClose={() => setDialog(null)} onDone={done}
          successMessage="Teacher access revoked" action={(reason) => api.post(`/admin/users/${dialog.application.user._id}/revoke-teacher`, { reason })} />
      )}
    </div>
  );
}
