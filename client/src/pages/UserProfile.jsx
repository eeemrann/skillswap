import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Icon from '../components/Icon';

const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

export default function UserProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState({ averageRating: 0, totalReviews: 0 });
  const [selectedSkill, setSelectedSkill] = useState('');
  const [proposedTime, setProposedTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.get(`/users/${id}`), api.get(`/reviews/${id}`)])
      .then(([profileResult, reviewResult]) => {
        if (!active) return;
        setProfile(profileResult.data);
        setReviews(reviewResult.data.reviews || []);
        setReviewSummary(reviewResult.data);
      })
      .catch((err) => active && setError(err.response?.data?.message || 'This expert profile could not be loaded.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  const requestSession = async (event) => {
    event.preventDefault();
    setSending(true); setError(''); setMessage('');
    try {
      await api.post('/bookings', { providerId: id, skill: selectedSkill, proposedTime: new Date(proposedTime).toISOString(), durationMinutes: 60 }, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
      setMessage(`Your ${selectedSkill} request has been sent.`);
      setProposedTime('');
    } catch (err) { setError(err.response?.data?.message || 'Your session request could not be sent.'); }
    finally { setSending(false); }
  };

  if (loading) return <AppShell eyebrow="Community expert" title="Loading profile…"><div className="expert-profile-loading"/></AppShell>;
  if (!profile) return <AppShell eyebrow="Community expert" title="Profile unavailable"><div className="bento-empty"><strong>We couldn’t find this expert.</strong><span>{error}</span><Link className="secondary-button" to="/browse">Back to Discover</Link></div></AppShell>;

  const firstName = profile.name.split(' ')[0];
  const location = profile.location?.city ? `${profile.location.city}${profile.location.country ? `, ${profile.location.country}` : ''}` : 'Global member';

  return (
    <AppShell eyebrow="Community expert" title={profile.name} description={`${location} · ${reviewSummary.totalReviews || 0} verified reviews`}>
      <div className="expert-profile-header page-enter"><span className="expert-profile-avatar">{initials(profile.name)}</span><div><span className="expert-availability"><i/> Available for exchanges</span><p>{profile.bio || 'This expert prefers to let their skills and community exchanges speak for themselves.'}</p></div><div className="expert-proof"><strong>{reviewSummary.averageRating || 'New'}</strong><span>{reviewSummary.averageRating ? 'average rating' : 'community expert'}</span></div></div>

      {message && <p className="status-message">{message}</p>}
      {error && <p className="status-message error">{error}</p>}

      <div className="expert-profile-layout">
        <main className="expert-profile-main page-enter">
          <section className="expert-profile-section"><div className="section-eyebrow">Professional bio</div><p className="professional-bio">{profile.bio || 'This expert prefers to let their skills and community exchanges speak for themselves.'}</p></section>
          <div className="expert-skill-columns">
            <section><div className="section-eyebrow">Can teach</div><div className="skill-pill-group">{profile.skillsOffered?.length ? profile.skillsOffered.map((skill) => <button type="button" className={`skill-pill-large ${selectedSkill === skill ? 'selected' : ''}`} key={skill} onClick={() => setSelectedSkill(skill)}>{skill}</button>) : <span className="form-hint">No expertise listed yet.</span>}</div></section>
            <section><div className="section-eyebrow">Wants to learn</div><div className="skill-pill-group">{profile.skillsWanted?.length ? profile.skillsWanted.map((skill) => <span className="skill-pill-large wanted" key={skill}>{skill}</span>) : <span className="form-hint">Open to new ideas.</span>}</div></section>
          </div>
          <section className="expert-profile-section review-section"><div className="section-eyebrow">Endorsements & reviews</div>{reviews.length === 0 ? <div className="profile-review-empty"><Icon name="message" size={20}/><span>No reviews yet for this member.</span></div> : <div className="profile-review-list">{reviews.map((review) => <article className="profile-review" key={review._id}><header><span><strong>{review.reviewer?.name || 'SkillSwap member'}</strong><small>{new Date(review.createdAt).toLocaleDateString()}</small></span><span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></header>{review.comment && <p>{review.comment}</p>}</article>)}</div>}</section>
        </main>

        <aside className="expert-booking-aside"><form className="expert-booking-card" onSubmit={requestSession}><span className="booking-card-icon"><Icon name="calendar" size={18}/></span><h2>Book a session</h2><p>Select a skill and request a one-hour exchange with {firstName}.</p><div className="profile-skill-options">{profile.skillsOffered?.map((skill) => <button type="button" className={selectedSkill === skill ? 'active' : ''} key={skill} onClick={() => setSelectedSkill(skill)}><span>{skill}</span><Icon name="arrow" size={14}/></button>)}</div><div className="form-field"><label htmlFor="profile-time">Proposed date and time</label><input id="profile-time" type="datetime-local" value={proposedTime} onChange={(event) => setProposedTime(event.target.value)} required/></div><button className="primary-button" type="submit" disabled={!selectedSkill || sending}>{sending ? 'Sending request…' : selectedSkill ? `Request ${selectedSkill}` : 'Select a skill'}</button><div className="booking-cost"><span>Session cost</span><strong>1 time credit</strong></div></form></aside>
      </div>
    </AppShell>
  );
}
