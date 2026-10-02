import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Icon from '../components/Icon';
import ApplicationForm from '../components/teach/ApplicationForm';
import TeacherSettings from '../components/teach/TeacherSettings';
import { useQuery } from '../lib/hooks';
import { formatDate } from '../lib/format';
import { APPLICATION_STATUS, CREDENTIAL_KIND_LABEL, TEACHER_TYPE_LABEL } from '../lib/teachers';
import { updateUser } from '../redux/authSlice';

const BENEFITS = [
  ['wallet', 'Get paid in real money', 'Every finished session earns credits. Cash them out to your bank at a fixed rate, with a small platform fee only when you teach.'],
  ['shield', 'A trusted marketplace', 'Learners only see verified experts, so you are never lost among unverified profiles. Your credentials are shown on your profile.'],
  ['calendar', 'Teach on your terms', 'Set your own hourly rate and availability. Sessions run in our built-in video room with screen sharing, nothing to install.']
];

const STEPS = [
  ['Apply', 'Tell us how you qualify and add proof: a degree, certification, job or published work.'],
  ['We verify', 'A reviewer checks your links and credentials, usually within two business days.'],
  ['Start teaching', 'Learners can book you. Set up payouts with Stripe and cash out your earnings.']
];

function Intro() {
  return (
    <div className="stack" style={{ '--gap': '22px' }}>
      <div className="grid cols-3">
        {BENEFITS.map(([icon, title, text]) => (
          <article className="card card-pad stack" style={{ '--gap': '8px' }} key={title}>
            <span className="feature-icon"><Icon name={icon} size={20} /></span>
            <h3 className="card-title">{title}</h3>
            <p className="small muted">{text}</p>
          </article>
        ))}
      </div>
      <ol className="card card-pad how-steps">
        {STEPS.map(([title, text], index) => (
          <li key={title}><span className="step-dot">{index + 1}</span><div className="stack" style={{ '--gap': '2px' }}><strong>{title}</strong><span className="small muted">{text}</span></div></li>
        ))}
      </ol>
    </div>
  );
}

function Pending({ application, onEdit }) {
  return (
    <div className="stack" style={{ '--gap': '20px' }}>
      <section className="card card-pad stack" style={{ '--gap': '16px' }}>
        <div className="row spread">
          <h2 className="card-title">Your application is in review</h2>
          <span className="badge warning">In review</span>
        </div>
        <p className="muted">You applied on {formatDate(application.submittedAt)}. A reviewer will check your credentials and links, usually within two business days. We email you the moment there is a decision.</p>
        <ol className="how-steps">
          <li className="done"><span className="step-dot"><Icon name="check" size={14} /></span><strong>Submitted</strong></li>
          <li><span className="step-dot">2</span><strong>Under review</strong></li>
          <li className="future"><span className="step-dot">3</span><strong>Start teaching</strong></li>
        </ol>
      </section>

      <section className="card card-pad stack" style={{ '--gap': '14px' }}>
        <h2 className="card-title">What you submitted</h2>
        <p className="small"><strong>{application.headline}</strong></p>
        <div className="tags">{application.skills.map((skill) => <span className="tag brand" key={skill}>{skill}</span>)}</div>
        <ul className="stack small muted" style={{ '--gap': '6px' }}>
          <li>{TEACHER_TYPE_LABEL[application.teacherType]}{application.organization ? ` · ${application.organization}` : ''}</li>
          {application.credentials.map((item, index) => <li key={index}><Icon name="check" size={13} /> {CREDENTIAL_KIND_LABEL[item.kind]}: {item.title}, {item.issuer}</li>)}
          {application.institutionalEmail && <li><Icon name={application.institutionalEmailVerified ? 'checkCircle' : 'clock'} size={13} /> {application.institutionalEmail} {application.institutionalEmailVerified ? '(verified)' : '(not verified yet)'}</li>}
        </ul>
        <div className="row"><button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>Edit application</button></div>
      </section>
    </div>
  );
}

export default function TeachApply() {
  const dispatch = useDispatch();
  const mine = useQuery(() => api.get('/teachers/me').then((r) => r.data), [], { interval: 60000 });
  const [editing, setEditing] = useState(false);
  const data = mine.data;
  const status = data?.status || 'none';
  const application = data?.application;

  const refreshProfile = () => api.get('/users/me').then((r) => dispatch(updateUser(r.data))).catch(() => {});
  const submitted = () => { setEditing(false); mine.reload(); refreshProfile(); };

  let body;
  if (mine.loading) body = <div className="skeleton" style={{ height: 320 }} />;
  else if (mine.error && !data) body = <p className="alert error" role="alert">We could not load your teacher status. <button type="button" className="btn btn-sm btn-secondary" onClick={mine.reload}>Retry</button></p>;
  else if (editing) {
    body = <ApplicationForm rules={data.rules} application={application} mode={status === 'approved' ? 'expand' : 'apply'} emailVerified={Boolean(application?.institutionalEmailVerified)} onSubmitted={submitted} onCancel={() => setEditing(false)} />;
  } else if (status === 'approved') {
    body = (
      <div className="stack" style={{ '--gap': '22px' }}>
        {application?.status === 'pending' && <p className="alert warning" role="status"><Icon name="clock" /> Your request for additional skills is being reviewed. Your current skills stay bookable meanwhile.</p>}
        {application?.status === 'rejected' && application.decisionReason && <p className="alert warning" role="status"><Icon name="info" /> Your last request for more skills was not approved: {application.decisionReason}</p>}
        <TeacherSettings teaching={data.teaching} application={application} onRequestSkills={() => setEditing(true)} onChanged={mine.reload} />
      </div>
    );
  } else if (status === 'pending' && application) {
    body = <Pending application={application} onEdit={() => setEditing(true)} />;
  } else {
    body = (
      <div className="stack" style={{ '--gap': '22px' }}>
        {status === 'rejected' && application?.decisionReason && <div className="alert error" role="alert"><Icon name="alert" /><div className="stack" style={{ '--gap': '4px' }}><strong>Your application needs changes</strong><span>{application.decisionReason}</span><span className="small">Update the details below and submit again.</span></div></div>}
        {status === 'revoked' && <div className="alert error" role="alert"><Icon name="alert" /><div className="stack" style={{ '--gap': '4px' }}><strong>Your teacher access was removed</strong><span>{application?.decisionReason || 'Contact support if you think this was a mistake.'}</span><span className="small">You can apply again with updated proof.</span></div></div>}
        {status === 'none' && <Intro />}
        <ApplicationForm rules={data.rules} application={application} emailVerified={Boolean(application?.institutionalEmailVerified)} onSubmitted={submitted} />
      </div>
    );
  }

  const meta = APPLICATION_STATUS[status] || APPLICATION_STATUS.none;
  return (
    <AppShell eyebrow="Teach & earn" title={status === 'approved' ? 'Your teaching profile' : 'Become a verified teacher'}
      description={status === 'approved' ? 'Manage your price and skills, and get ready to earn.' : 'Lecturers, engineers and certified trainers: teach live 1:1 sessions and get paid. Every teacher is verified by hand.'}
      action={status !== 'none' && !editing ? <span className={`badge ${meta.tone}`}>{meta.label}</span> : null}>
      {body}
      {!mine.loading && status === 'none' && <p className="small faint center" style={{ marginTop: 18 }}>Just here to learn? You do not need to be verified. <Link to="/browse">Find a teacher</Link>.</p>}
    </AppShell>
  );
}
