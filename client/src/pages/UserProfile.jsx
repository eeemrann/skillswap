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
        const loadedProfile = profileResult.data;
        setProfile(loadedProfile);
        setSelectedSkill(loadedProfile.skillsOffered?.[0] || '');
        setReviews(reviewResult.data.reviews || []);
        setReviewSummary(reviewResult.data);
      })
      .catch((requestError) => active && setError(requestError.response?.data?.message || 'This expert profile could not be loaded.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  const handleBooking = async (event) => {
    event.preventDefault();
    setSending(true);
    setError('');
    setMessage('');
    try {
      await api.post('/bookings', { providerId: id, skill: selectedSkill, proposedTime: new Date(proposedTime).toISOString(), durationMinutes: 60 }, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
      setMessage(`Your ${selectedSkill} request has been sent successfully.`);
      setProposedTime('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Your session request could not be sent.');
    } finally { setSending(false); }
  };

  if (loading) return <AppShell eyebrow="Expert Portfolio" title="Calibrating profile…"><div className="expert-profile-loading" /></AppShell>;
  if (!profile) return <AppShell eyebrow="Expert Portfolio" title="Profile unavailable"><div className="glass-directory-empty"><strong>We couldn’t find this expert.</strong><span>{error}</span><Link className="secondary-button" to="/browse">Back to Discover</Link></div></AppShell>;

  const location = profile.location?.city ? `${profile.location.city}${profile.location.country ? `, ${profile.location.country}` : ''}` : 'Global member';
  const offeredSkills = profile.skillsOffered || [];
  const wantedSkills = profile.skillsWanted || [];

  return (
    <AppShell eyebrow="DOSSIER // EXPERT_01" title={profile.name} description={`${location} // ${reviewSummary.totalReviews || 0}_VERIFIED_REVIEWS`}>
      <div className="expert-profile-layout prestige-profile foundry-dossier-layout page-enter">
        <main className="expert-profile-main">
          <section className="foundry-card prestige-profile-hero foundry-dossier-hero">
            <div className="expert-profile-avatar">{initials(profile.name)}</div>
            <div><div className="f-badge active"><i /> Verified Expert</div><p>{profile.bio || 'Bio protocols not initialized.'}</p></div>
            <div className="prestige-rating"><strong>{reviewSummary.averageRating || 'New'}</strong><span>{reviewSummary.averageRating ? 'average rating' : 'community expert'}</span></div>
          </section>

          <div className="prestige-skill-grid">
            <section className="foundry-card"><span className="mono-label">Capabilities</span><div className="skill-pill-group">{offeredSkills.length ? offeredSkills.map((skill) => <span key={skill} className="foundry-tag dossier-tag">{skill}</span>) : <span className="form-hint">NO_CAPABILITIES_LISTED</span>}</div></section>
            <section className="foundry-card"><span className="mono-label">Acquisitions</span><div className="skill-pill-group">{wantedSkills.length ? wantedSkills.map((skill) => <span key={skill} className="foundry-tag dossier-tag muted">{skill}</span>) : <span className="form-hint">OPEN_ACQUISITION_STATE</span>}</div></section>
          </div>

          <section className="prestige-reviews">
            <span className="section-eyebrow">Endorsements</span>
            {reviews.length === 0 ? <div className="profile-review-empty"><Icon name="message" size={20} /> No community reviews yet.</div> : <div className="profile-review-list">{reviews.map((review) => <article key={review._id} className="foundry-card prestige-review"><header><span><strong>{review.reviewer?.name || 'SkillSwap member'}</strong><small>{review.createdAt ? new Date(review.createdAt).toLocaleDateString() : 'Verified exchange'}</small></span><span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></header>{review.comment && <p>{review.comment}</p>}</article>)}</div>}
          </section>
        </main>

        <aside className="expert-booking-aside">
          <form onSubmit={handleBooking} className="foundry-card expert-booking-card prestige-booking-card foundry-exchange-card">
            <div className="booking-card-icon"><Icon name="calendar" size={20} /></div>
            <h2>Initiate Exchange</h2>
            <p>Request a one-hour exchange. One credit transfers only after completion.</p>

            <div className="input-group-premium"><label>Select Expertise</label><div className="prestige-skill-options">{offeredSkills.map((skill) => <button type="button" key={skill} className={`skill-pill-large ${selectedSkill === skill ? 'selected' : ''}`} onClick={() => setSelectedSkill(skill)}>{skill}</button>)}</div>{offeredSkills.length === 0 && <span className="form-hint">This expert has not listed a bookable skill yet.</span>}</div>
            <div className="input-group-premium"><label htmlFor="profile-time">Proposed Time</label><input id="profile-time" type="datetime-local" className="foundry-input prestige-time-input" value={proposedTime} onChange={(event) => setProposedTime(event.target.value)} required /></div>
            <button type="submit" className="primary-button" disabled={!selectedSkill || sending}>{sending ? 'PROCESSING...' : 'SEND_REQUEST'}</button>
            {message && <p className="prestige-form-message success" role="status">{message}</p>}
            {error && <p className="prestige-form-message error" role="alert">{error}</p>}
            <div className="booking-cost"><span>Transaction Amount</span><strong>1.0 Credit</strong></div>
          </form>
        </aside>
      </div>
    </AppShell>
  );
}
