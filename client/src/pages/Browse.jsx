import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Icon from '../components/Icon';
import { SEARCH_RADIUS_OPTIONS, setRadiusKm } from '../redux/searchRadiusSlice';

const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

function Browse() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationActive, setLocationActive] = useState(true);
  const [noNearbyUsers, setNoNearbyUsers] = useState(false);
  const dispatch = useDispatch();
  const radiusKm = useSelector((state) => state.searchRadius.radiusKm);

  useEffect(() => {
    let active = true;
    const loadUsers = async (initial = false) => {
      if (initial) setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ radiusKm: String(radiusKm) });
        let usedLocation = false;
        if (radiusKm !== 'worldwide' && !document.hidden && navigator.geolocation) {
          try {
            const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { maximumAge: 600000, timeout: 10000 }));
            const { longitude, latitude } = position.coords;
            await api.patch('/users/me/location', { longitude, latitude });
            params.set('lng', longitude);
            params.set('lat', latitude);
            usedLocation = true;
          } catch { if (active) setLocationActive(false); }
        }
        const response = await api.get(`/users?${params.toString()}`);
        if (!active) return;
        const payload = Array.isArray(response.data) ? response.data : response.data.users || [];
        const fellBack = response.headers?.['x-location-fallback'] === 'true';
        setUsers(payload);
        setLocationActive(radiusKm === 'worldwide' || (usedLocation && !fellBack));
        setNoNearbyUsers(radiusKm !== 'worldwide' && usedLocation && !fellBack && payload.length === 0);
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.message || 'We could not load the expert directory right now.');
      } finally { if (active && initial) setLoading(false); }
    };
    loadUsers(true);
    const refresh = () => { if (!document.hidden) loadUsers(false); };
    window.addEventListener('focus', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); };
  }, [radiusKm]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return users;
    return users.filter((user) => `${user.name || ''} ${(user.skillsOffered || []).join(' ')} ${(user.skillsWanted || []).join(' ')}`.toLowerCase().includes(search));
  }, [users, query]);

  const radiusControl = (
    <label className="radius-pill-glass">
      <Icon name="search" size={14} />
      <span className="sr-only">Search radius</span>
      <select value={radiusKm} onChange={(event) => dispatch(setRadiusKm(event.target.value === 'worldwide' ? 'worldwide' : Number(event.target.value)))}>
        {SEARCH_RADIUS_OPTIONS.map((option) => <option key={option} value={option}>{option === 'worldwide' ? 'Worldwide' : `${option} km`}</option>)}
      </select>
    </label>
  );

  return (
    <AppShell eyebrow="Marketplace" title="Discover Expertise" description="Explore specialists, their work, and the knowledge they are ready to share." action={radiusControl}>
      <div className="glass-search-container page-enter">
        <Icon name="search" size={20} className="glass-search-icon" />
        <input className="glass-search-input" placeholder="Search by expert name or specific skill…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search experts" />
        {query && <button className="glass-search-clear" type="button" onClick={() => setQuery('')} aria-label="Clear search">&times;</button>}
      </div>

      <div className="glass-directory-meta"><span>{loading ? 'Loading directory…' : `${filtered.length} ${filtered.length === 1 ? 'expert' : 'experts'}`}</span><span>{radiusKm === 'worldwide' ? 'Global directory' : locationActive ? `Within ${radiusKm} km` : 'Location unavailable — showing broader results'}</span></div>
      {error && <p className="status-message error">{error}</p>}

      {loading ? <div className="portfolio-grid">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="expert-profile-loading" />)}</div>
        : noNearbyUsers ? <div className="glass-directory-empty"><Icon name="users" size={24}/><strong>No nearby experts yet</strong><span>Expand your radius to discover more community members.</span><button className="secondary-button" type="button" onClick={() => dispatch(setRadiusKm('worldwide'))}>Search worldwide</button></div>
          : filtered.length === 0 ? <div className="glass-directory-empty"><Icon name="search" size={24}/><strong>No experts match “{query}”</strong><span>Try a broader skill or search by member name.</span></div>
            : <div className="portfolio-grid page-enter">{filtered.map((user) => {
              const skills = user.skillsOffered || [];
              return <Link to={`/profile/${user._id}`} key={user._id} className="expert-card-glass">
                <span className="avatar-lg">{initials(user.name)}</span>
                <div className="expert-card-body"><h3>{user.name}</h3><p className="expert-card-meta">{user.location?.city || 'Global member'} <span>•</span> {user.reviewCount || 0} reviews</p><p className="expert-card-bio-glass">{user.bio || 'No professional bio provided yet.'}</p></div>
                <div className="expert-card-skills">{skills.slice(0, 2).map((skill) => <span key={skill} className="skill-tag-glass">{skill}</span>)}{skills.length > 2 && <span className="skill-count-glass">+{skills.length - 2}</span>}{skills.length === 0 && <span className="skill-count-glass">Profile in progress</span>}</div>
              </Link>;
            })}</div>}
    </AppShell>
  );
}

export default Browse;
