import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import Stars from '../components/Stars';
import { locationLabel } from '../lib/format';
import { useDebounced, useGeolocation, useQuery } from '../lib/hooks';
import { SEARCH_RADIUS_OPTIONS, setRadiusKm } from '../redux/searchRadiusSlice';

const PAGE_SIZE = 24;

function TeacherCard({ member }) {
  const skills = member.skillsOffered || [];
  return (
    <Link className="card interactive teacher-card" to={`/profile/${member._id}`}>
      <div className="row nowrap" style={{ alignItems: 'flex-start' }}>
        <Avatar name={member.name} src={member.profilePicture} size="lg" />
        <div className="grow stack" style={{ '--gap': '3px' }}>
          <span className="row nowrap" style={{ gap: 6 }}><strong className="truncate">{member.name}</strong>{member.isPro && <span className="badge pro">Pro</span>}</span>
          <span className="small muted truncate"><Icon name="pin" size={12} /> {locationLabel(member.location) || 'Online'}{member.distanceKm != null ? ` · ${member.distanceKm} km` : ''}</span>
          <Stars value={member.averageRating} count={member.reviewCount} />
        </div>
      </div>
      {member.bio && <p className="small muted clamp-2">{member.bio}</p>}
      <div className="tags">
        {skills.slice(0, 4).map((skill) => <span className="tag brand" key={skill}>{skill}</span>)}
        {skills.length > 4 && <span className="tag">+{skills.length - 4}</span>}
      </div>
      {member.languages?.length > 0 && <p className="tiny faint"><Icon name="globe" size={12} /> {member.languages.join(' · ')}</p>}
    </Link>
  );
}

export default function Browse() {
  const dispatch = useDispatch();
  const radiusKm = useSelector((state) => state.searchRadius.radiusKm);
  const wanted = useSelector((state) => state.auth.user?.skillsWanted) || [];
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const nearby = radiusKm !== 'worldwide';
  const geo = useGeolocation(nearby);
  const waitingForLocation = nearby && geo.status === 'loading';
  const locationFailed = nearby && ['denied', 'unsupported'].includes(geo.status);
  const useGeo = nearby && geo.status === 'granted';

  const directory = useQuery(async () => {
    const params = { limit: PAGE_SIZE, page };
    if (q) params.q = q;
    if (useGeo) Object.assign(params, { lng: geo.coords.lng, lat: geo.coords.lat, radiusKm });
    const response = await api.get('/users', { params });
    return { items: response.data, total: Number(response.headers['x-total-count'] || response.data.length) };
  }, [q, page, useGeo, radiusKm, geo.coords?.lng, geo.coords?.lat], { enabled: !waitingForLocation });

  const changeSearch = (value) => { setSearch(value); setPage(1); };
  const items = directory.data?.items || [];
  const total = directory.data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const loading = directory.loading || waitingForLocation;

  return (
    <AppShell eyebrow="Discover" title="Find someone to learn from" description="Every session is a live video call, so you can learn from anyone, anywhere.">
      <div className="stack" style={{ '--gap': '20px' }}>
        <div className="toolbar">
          <div className="input-icon grow">
            <Icon name="search" size={18} />
            <input className="input" type="search" placeholder="Search skills or names: Spanish, Figma, guitar…" value={search} onChange={(event) => changeSearch(event.target.value)} aria-label="Search teachers" />
          </div>
          <label className="row nowrap" style={{ gap: 8 }}>
            <span className="small muted">Show</span>
            <select className="select" style={{ width: 'auto' }} value={radiusKm} onChange={(event) => { setPage(1); dispatch(setRadiusKm(event.target.value === 'worldwide' ? 'worldwide' : Number(event.target.value))); }} aria-label="Distance">
              {SEARCH_RADIUS_OPTIONS.map((option) => <option key={option} value={option}>{option === 'worldwide' ? 'Anywhere (online)' : `Within ${option} km`}</option>)}
            </select>
          </label>
        </div>

        {wanted.length > 0 && (
          <div className="row" style={{ gap: 8 }} aria-label="Your learning goals">
            <span className="small muted">Your goals:</span>
            {wanted.slice(0, 6).map((skill) => <button type="button" key={skill} className={`tag chip-button ${q.toLowerCase() === skill.toLowerCase() ? 'brand' : ''}`} onClick={() => changeSearch(q.toLowerCase() === skill.toLowerCase() ? '' : skill)}>{skill}</button>)}
          </div>
        )}

        {locationFailed && <p className="alert warning" role="status"><Icon name="info" /> We could not get your location, so you are seeing members from anywhere. Allow location access in your browser to filter by distance.</p>}
        {directory.error && <p className="alert error" role="alert">{directory.error.response?.data?.message || 'We could not load the directory right now.'} <button type="button" className="btn btn-sm btn-secondary" onClick={directory.reload}>Retry</button></p>}

        <p className="small muted" aria-live="polite">{loading ? 'Searching…' : `${total} ${total === 1 ? 'teacher' : 'teachers'}${q ? ` for “${q}”` : ''}${useGeo ? ` within ${radiusKm} km` : ''}`}</p>

        {loading ? <div className="grid auto">{[1, 2, 3, 4, 5, 6].map((n) => <div className="skeleton" style={{ height: 210 }} key={n} />)}</div>
          : items.length === 0 ? (
            <div className="card"><EmptyState icon="search" title={q ? `No one teaches “${q}” yet` : 'No teachers found'}
              action={useGeo ? <button type="button" className="btn btn-secondary" onClick={() => dispatch(setRadiusKm('worldwide'))}>Search anywhere</button> : q ? <button type="button" className="btn btn-secondary" onClick={() => changeSearch('')}>Clear search</button> : null}>
              Try a broader skill, or search anywhere. Sessions are online, so distance does not matter.
            </EmptyState></div>
          ) : <div className="grid auto">{items.map((member) => <TeacherCard member={member} key={member._id} />)}</div>}

        {pages > 1 && !loading && (
          <nav className="row spread" aria-label="Pagination">
            <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><Icon name="arrowLeft" size={16} /> Previous</button>
            <span className="small muted">Page {page} of {pages}</span>
            <button type="button" className="btn btn-secondary" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next <Icon name="arrow" size={16} /></button>
          </nav>
        )}
      </div>
    </AppShell>
  );
}
