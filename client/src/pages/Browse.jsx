import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Icon from '../components/Icon';
import { SEARCH_RADIUS_OPTIONS, setRadiusKm } from '../redux/searchRadiusSlice';

const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

function Browse() {
  const [users, setUsers] = useState([]); const [query, setQuery] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [locationActive, setLocationActive] = useState(true);
  const [noNearbyUsers, setNoNearbyUsers] = useState(false);
  const [bookingForm, setBookingForm] = useState(null); const [proposedTime, setProposedTime] = useState(''); const [message, setMessage] = useState(''); const [sending, setSending] = useState(false);
  const [reviewProfile, setReviewProfile] = useState(null); const [reviewsLoading, setReviewsLoading] = useState(false);
  const dispatch = useDispatch();
  const radiusKm = useSelector((state) => state.searchRadius.radiusKm);
  const radiusLabel = radiusKm === 'worldwide' ? 'Worldwide' : `${radiusKm}km`;
  useEffect(() => {
    let active = true;
    const loadUsers = async (initial = false) => {
      try {
        let locationQuery = '';
        let usedLocation = false;
        if (radiusKm !== 'worldwide' && !document.hidden && navigator.geolocation) {
          try {
            const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { maximumAge: 600000, timeout: 10000 }));
            const { longitude, latitude } = position.coords;
            await api.patch('/users/me/location', { longitude, latitude });
            locationQuery = `?lng=${encodeURIComponent(longitude)}&lat=${encodeURIComponent(latitude)}`;
            usedLocation = true;
          } catch {
            setLocationActive(false);
          }
        }
        const params = new URLSearchParams(locationQuery.slice(1));
        params.set('radiusKm', radiusKm);
        const res = await api.get(`/users?${params.toString()}`);
        if (!active) return;
        const payload = Array.isArray(res.data) ? { users: res.data, locationRequired: false } : res.data;
        setUsers(payload.users || []);
        const locationFallback = res.headers?.['x-location-fallback'] === 'true';
        setLocationActive(radiusKm === 'worldwide' || (usedLocation && !payload.locationRequired && !locationFallback));
        setNoNearbyUsers(radiusKm !== 'worldwide' && usedLocation && !locationFallback && (payload.users || []).length === 0);
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.message || 'We could not load the community right now.');
      } finally {
        if (active && initial) setLoading(false);
      }
    };
    loadUsers(true);
    const refreshOnFocus = () => loadUsers(false);
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [radiusKm]);
  const enableLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      api.patch('/users/me/location', { longitude: coords.longitude, latitude: coords.latitude })
        .then(() => window.dispatchEvent(new Event('focus')))
        .catch(() => setError('Location could not be updated.'));
    }, () => setError('Location access is needed to show nearby members.'));
  };
  const visibleUsers = useMemo(() => users.filter((user) => `${user.name} ${(user.skillsOffered || []).join(' ')} ${(user.skillsWanted || []).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())), [users, query]);
  const openBookingForm = (providerId, providerName, skill) => { setBookingForm({ providerId, providerName, skill }); setMessage(''); };
  const submitBooking = async (event) => { event.preventDefault(); setSending(true); setError(''); try { const key = crypto.randomUUID(); await api.post('/bookings', { providerId: bookingForm.providerId, skill: bookingForm.skill, proposedTime: new Date(proposedTime).toISOString(), durationMinutes: 60 }, { headers: { 'Idempotency-Key': key } }); setMessage(`Request sent to ${bookingForm.providerName}.`); setBookingForm(null); setProposedTime(''); } catch (err) { setError(err.response?.data?.message || 'Failed to send request.'); } finally { setSending(false); } };
  const showReviews = async (user) => { setReviewProfile({ user, reviews: [], averageRating: user.averageRating || 0, totalReviews: user.reviewCount || 0 }); setReviewsLoading(true); setError(''); try { const { data } = await api.get(`/reviews/${user._id}`); setReviewProfile({ user, ...data }); } catch (err) { setError(err.response?.data?.message || 'Could not load reviews.'); setReviewProfile(null); } finally { setReviewsLoading(false); } };
  const increaseRadius = () => {
    const currentIndex = SEARCH_RADIUS_OPTIONS.indexOf(radiusKm);
    const nextRadius = SEARCH_RADIUS_OPTIONS[Math.min(currentIndex + 1, SEARCH_RADIUS_OPTIONS.length - 1)];
    if (nextRadius !== radiusKm) dispatch(setRadiusKm(nextRadius));
  };
  return (
    <AppShell eyebrow="Skill marketplace" title="Learn from people, not feeds." description="Discover generous people with practical experience and find your next meaningful exchange." action={<span className="match-score"><Icon name="users" size={14}/>{users.length} members</span>}>
      <div className="browse-toolbar">
        <div className="status-message"><span>{locationActive ? `Showing members ${radiusKm === 'worldwide' ? 'worldwide' : `within ${radiusKm} km`}` : 'Location access needed to find nearby members'}</span>{!locationActive && <button type="button" className="ghost-button" onClick={enableLocation}>Enable Location</button>}</div>
        <label className="radius-control"><span>Search radius</span><select value={radiusKm} onChange={(event) => dispatch(setRadiusKm(event.target.value === 'worldwide' ? 'worldwide' : Number(event.target.value)))} aria-label="Search radius">{SEARCH_RADIUS_OPTIONS.map((option) => <option value={option} key={option}>{option === 'worldwide' ? 'Worldwide' : `${option}km`}</option>)}</select></label>
      </div>
      {message && <p className="status-message">{message}</p>}{error && <p className="status-message error">{error}</p>}
      <div className="filter-bar"><div className="filter-copy"><strong>Explore the community</strong><small>Search by member, skill, or interest</small></div><div className="search-wrap"><Icon name="search" size={16}/><input className="search-input" aria-label="Search skills or people" placeholder="Try photography, Excel, Spanish..." value={query} onChange={(event) => setQuery(event.target.value)}/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">&times;</button>}</div></div>
      {loading && <div className="people-grid">{[1,2,3,4,5,6].map((item)=><div className="person-card skeleton-card" key={item}><span/><span/><span/><span/></div>)}</div>}
      {!loading && noNearbyUsers && <div className="radius-empty empty-state"><strong>No members within {radiusLabel}</strong><span>Try a larger search radius to discover more SkillSwap members.</span>{radiusKm !== 'worldwide' && <button type="button" className="primary-button" onClick={increaseRadius}>Try {SEARCH_RADIUS_OPTIONS[SEARCH_RADIUS_OPTIONS.indexOf(radiusKm) + 1] === 'worldwide' ? 'Worldwide' : `${SEARCH_RADIUS_OPTIONS[SEARCH_RADIUS_OPTIONS.indexOf(radiusKm) + 1]}km`}</button>}</div>}
      {!loading && !noNearbyUsers && visibleUsers.length === 0 && <div className="empty-state"><strong>No matches found</strong>Try another name or a broader skill.</div>}
      <div className="people-grid">{visibleUsers.map((user) => <article className="person-card" key={user._id}><div className="person-top"><span className="avatar">{initials(user.name)}</span><div><h3>{user.name}</h3><p>{user.location?.city ? `${user.location.city}${user.location?.country ? `, ${user.location.country}` : ''}` : 'SkillSwap community member'}</p></div>{user.reviewCount > 0 && <span className="rating-pill">★ {user.averageRating}</span>}</div>{user.bio && <p className="person-bio">{user.bio}</p>}<div className="skill-group"><small>Can teach</small><div className="skill-tags">{user.skillsOffered?.length ? user.skillsOffered.map((skill)=><span className="skill-tag" key={skill}>{skill}</span>) : <span className="form-hint">No skills listed yet</span>}</div></div><div className="skill-group"><small>Wants to learn</small><p>{user.skillsWanted?.length ? user.skillsWanted.join(' · ') : 'Open to new ideas'}</p></div><div className="person-actions">{user.skillsOffered?.map((skill)=><button className="primary-button" type="button" key={skill} onClick={()=>openBookingForm(user._id,user.name,skill)}>Request {skill}<Icon name="arrow" size={14}/></button>)}<button className="ghost-button" type="button" onClick={() => showReviews(user)}>Reviews ({user.reviewCount || 0})</button></div></article>)}</div>
      {bookingForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setBookingForm(null)}}><section className="booking-modal surface" role="dialog" aria-modal="true" aria-labelledby="booking-title"><button className="modal-close" type="button" onClick={()=>setBookingForm(null)} aria-label="Close">&times;</button><p className="page-eyebrow">New exchange request</p><h2 id="booking-title">Learn {bookingForm.skill}</h2><p className="page-description">Choose a convenient time with {bookingForm.providerName}. They can accept or decline your request.</p><form onSubmit={submitBooking}><div className="form-field"><label htmlFor="proposed-time">Proposed date and time</label><input id="proposed-time" type="datetime-local" value={proposedTime} onChange={(event)=>setProposedTime(event.target.value)} required/></div><div className="stack-actions"><button className="primary-button" type="submit" disabled={sending}>{sending ? 'Sending request...' : 'Send request'}</button><button className="ghost-button" type="button" onClick={()=>setBookingForm(null)}>Cancel</button></div></form></section></div>}
      {reviewProfile && <div className="modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setReviewProfile(null)}}><section className="booking-modal review-modal surface" role="dialog" aria-modal="true" aria-labelledby="reviews-title"><button className="modal-close" type="button" onClick={()=>setReviewProfile(null)} aria-label="Close">&times;</button><p className="page-eyebrow">Community feedback</p><h2 id="reviews-title">Reviews for {reviewProfile.user.name}</h2><div className="review-summary"><strong>★ {reviewProfile.averageRating || '—'}</strong><span>{reviewProfile.totalReviews} {reviewProfile.totalReviews === 1 ? 'review' : 'reviews'}</span></div>{reviewsLoading && <p className="form-hint">Loading reviews...</p>}{!reviewsLoading && reviewProfile.reviews.length === 0 && <div className="empty-state"><strong>No reviews yet</strong>Be the first after completing an exchange.</div>}<div className="review-list">{reviewProfile.reviews.map((review)=><article className="review-card" key={review._id}><div><strong>{review.reviewer?.name || 'SkillSwap member'}</strong><span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span></div>{review.comment && <p>{review.comment}</p>}<small>{new Date(review.createdAt).toLocaleDateString()}</small></article>)}</div></section></div>}
    </AppShell>
  );
}
export default Browse;
