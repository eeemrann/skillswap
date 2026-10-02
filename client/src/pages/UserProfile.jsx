import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import BookingForm from '../components/BookingForm';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import Stars from '../components/Stars';
import { capitalize, formatCredits, formatDate, idOf, locationLabel } from '../lib/format';
import { CREDENTIAL_KIND_LABEL, TEACHER_TYPE_LABEL, TIER_LABEL } from '../lib/teachers';
import { useQuery } from '../lib/hooks';

const byDay = (slots = []) => {
  const grouped = {};
  slots.forEach((slot) => { (grouped[slot.day] ||= []).push(`${slot.start}–${slot.end}`); });
  return Object.entries(grouped);
};

export default function UserProfile() {
  const { id } = useParams();
  const me = useSelector((state) => state.auth.user);
  const profile = useQuery(() => api.get(`/users/${id}`).then((r) => r.data), [id]);
  const reviews = useQuery(() => api.get(`/reviews/${id}`).then((r) => r.data), [id]);
  const isMe = idOf(me) === id;

  if (profile.loading) return <AppShell eyebrow="Profile" title="Loading…"><div className="skeleton" style={{ height: 320 }} /></AppShell>;
  if (!profile.data) {
    return (
      <AppShell eyebrow="Profile" title="Profile unavailable">
        <div className="card"><EmptyState icon="user" title="We could not find this member" action={<Link className="btn btn-secondary" to="/browse">Back to Discover</Link>}>{profile.error?.response?.data?.message || 'They may have left SkillSwap.'}</EmptyState></div>
      </AppShell>
    );
  }

  const p = profile.data;
  const summary = reviews.data || { averageRating: 0, totalReviews: 0, reviews: [] };
  const place = locationLabel(p.location);
  const teacher = p.teacher;

  return (
    <AppShell eyebrow={p.isTeacher ? 'Verified teacher' : 'Member profile'} title={p.name} wide action={<Link className="btn btn-ghost" to="/browse"><Icon name="arrowLeft" size={16} /> Back</Link>}>
      <div className="profile-layout">
        <div className="stack" style={{ '--gap': '24px' }}>
          <section className="card card-pad profile-head">
            <Avatar name={p.name} src={p.profilePicture} size="xl" />
            <div className="stack grow" style={{ '--gap': '8px' }}>
              <div className="row" style={{ gap: 8 }}>
                <h2 style={{ fontSize: 26 }}>{p.name}</h2>
                {p.isPro && <span className="badge pro"><Icon name="crown" size={12} /> Pro</span>}
              </div>
              {teacher && (
                <>
                  <p><strong>{teacher.headline}</strong></p>
                  <div className="row" style={{ gap: 8 }}>
                    <span className={`verified-badge ${teacher.tier === 'expert' ? 'expert' : ''}`}><Icon name="checkCircle" size={14} /> {TIER_LABEL[teacher.tier] || 'Verified'} teacher</span>
                    {teacher.teacherType && <span className="badge">{TEACHER_TYPE_LABEL[teacher.teacherType]}</span>}
                    {teacher.institutionVerified && <span className="badge brand">Institution email verified</span>}
                  </div>
                  {(teacher.jobTitle || teacher.organization) && <p className="small muted">{[teacher.jobTitle, teacher.organization].filter(Boolean).join(' · ')}{teacher.yearsExperience ? ` · ${teacher.yearsExperience} years of experience` : ''}</p>}
                </>
              )}
              <Stars value={summary.averageRating} count={summary.totalReviews} />
              <div className="row small muted" style={{ gap: 16 }}>
                {place && <span><Icon name="pin" size={13} /> {place}</span>}
                <span><Icon name="clock" size={13} /> {p.timezone}</span>
                {p.isTeacher && <span><Icon name="video" size={13} /> {p.sessionsTaught} {p.sessionsTaught === 1 ? 'session' : 'sessions'} taught</span>}
                <span>Member since {formatDate(p.createdAt, { month: 'short', year: 'numeric' })}</span>
              </div>
              {p.languages?.length > 0 && <p className="small muted"><Icon name="globe" size={13} /> Speaks {p.languages.join(', ')}</p>}
            </div>
          </section>

          <section className="card card-pad stack" style={{ '--gap': '12px' }}>
            <h2 className="card-title">About</h2>
            <p className="muted prose">{p.bio || 'This member has not written an introduction yet.'}</p>
          </section>

          {p.isTeacher ? (
            <>
              <section className="card card-pad stack" style={{ '--gap': '12px' }}>
                <h2 className="card-title">Teaches</h2>
                <div className="tags">{p.skillsOffered?.map((skill) => <span className="tag brand" key={skill}>{skill}</span>)}</div>
              </section>
              <section className="card card-pad stack" style={{ '--gap': '12px' }}>
                <div className="row spread"><h2 className="card-title">Verified credentials</h2><span className="tiny faint">Checked by SkillSwap{teacher.verifiedAt ? ` · ${formatDate(teacher.verifiedAt, { month: 'short', year: 'numeric' })}` : ''}</span></div>
                {teacher.credentials?.length ? (
                  <ul className="cred-list">
                    {teacher.credentials.map((item, index) => (
                      <li key={index}><Icon name="checkCircle" size={16} /><div className="stack" style={{ '--gap': '1px' }}><strong>{item.title}</strong><span className="small muted">{CREDENTIAL_KIND_LABEL[item.kind] || item.kind} · {item.issuer}{item.year ? ` · ${item.year}` : ''}</span></div></li>
                    ))}
                  </ul>
                ) : <p className="muted small">Credentials were verified privately.</p>}
              </section>
            </>
          ) : (
            <section className="card card-pad stack" style={{ '--gap': '12px' }}>
              <h2 className="card-title">Wants to learn</h2>
              <div className="tags">{p.skillsWanted?.length ? p.skillsWanted.map((skill) => <span className="tag" key={skill}>{skill}</span>) : <span className="muted small">Open to anything.</span>}</div>
              <p className="small muted">This member is a learner. Only verified teachers can be booked.</p>
            </section>
          )}

          {p.availability?.length > 0 && (
            <section className="card card-pad stack" style={{ '--gap': '12px' }}>
              <div className="row spread"><h2 className="card-title">Usual availability</h2><span className="tiny faint">Times in {p.timezone}</span></div>
              <ul className="availability-list">{byDay(p.availability).map(([day, ranges]) => <li key={day}><strong>{capitalize(day)}</strong><span className="muted">{ranges.join(', ')}</span></li>)}</ul>
            </section>
          )}

          <section className="card card-pad stack" style={{ '--gap': '14px' }}>
            <div className="row spread"><h2 className="card-title">Reviews</h2><Stars value={summary.averageRating} count={summary.totalReviews} /></div>
            {summary.reviews.length === 0 ? <p className="muted small">No reviews yet. Reviews come only from members who completed a session together.</p> : (
              <div className="stack" style={{ '--gap': '16px' }}>
                {summary.reviews.map((review) => (
                  <article className="review" key={review._id}>
                    <Avatar name={review.reviewer?.name} src={review.reviewer?.profilePicture} size="sm" />
                    <div className="grow stack" style={{ '--gap': '4px' }}>
                      <div className="row spread"><strong className="small">{review.reviewer?.name || 'SkillSwap member'}</strong><span className="tiny faint">{formatDate(review.createdAt)}</span></div>
                      <Stars value={review.rating} label={false} />
                      {review.comment && <p className="small muted">{review.comment}</p>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="profile-aside">
          {isMe ? (
            <section className="card card-pad stack" style={{ '--gap': '12px' }}><h2 className="card-title">This is you</h2><p className="muted small">{p.isTeacher ? `Learners see this page when they find you in Discover. You charge ${formatCredits(teacher.hourlyRateCredits)} credits per hour.` : 'Other members see this page when they open your name.'}</p><div className="row"><Link className="btn btn-secondary" to="/settings">Edit profile</Link>{p.isTeacher ? <Link className="btn btn-ghost" to="/teach">Teaching settings</Link> : <Link className="btn btn-ghost" to="/teach">Become a teacher</Link>}</div></section>
          ) : p.isTeacher ? <BookingForm profile={p} /> : (
            <section className="card card-pad stack" style={{ '--gap': '12px' }}><h2 className="card-title">Learn with a verified teacher</h2><p className="muted small">{p.name.split(' ')[0]} is a learner. Find a verified expert to book a live session.</p><Link className="btn btn-primary" to="/browse">Discover teachers</Link></section>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
