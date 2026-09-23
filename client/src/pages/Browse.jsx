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

  const filteredUsers = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return users;
    return users.filter((user) => `${user.name} ${(user.skillsOffered || []).join(' ')} ${(user.skillsWanted || []).join(' ')}`.toLowerCase().includes(search));
  }, [users, query]);

  return (
    <AppShell eyebrow="Marketplace" title="Discover expertise" description="Find people who have mastered the skills you want to learn." action={<label className="radius-control-premium"><Icon name="search" size={14}/><span className="sr-only">Search radius</span><select value={radiusKm} onChange={(event) => dispatch(setRadiusKm(event.target.value === 'worldwide' ? 'worldwide' : Number(event.target.value)))}>{SEARCH_RADIUS_OPTIONS.map((option) => <option key={option} value={option}>{option === 'worldwide' ? 'Worldwide' : `${option} km`}</option>)}</select></label>}>
      <div className="expert-search-wrap"><Icon name="search" size={20}/><input className="search-input-premium" placeholder="Search by name or skill — JavaScript, design, cooking…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search experts"/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">&times;</button>}</div>

      <div className="directory-meta"><span>{loading ? 'Loading directory…' : `${filteredUsers.length} ${filteredUsers.length === 1 ? 'expert' : 'experts'}`}</span><span>{radiusKm === 'worldwide' ? 'Global directory' : locationActive ? `Within ${radiusKm} km` : 'Location unavailable — showing broader results'}</span></div>
      {error && <p className="status-message error">{error}</p>}

      {loading ? <div className="expert-directory-grid">{[1, 2, 3, 4, 5, 6].map((item) => <div className="expert-directory-card expert-card-skeleton" key={item}><i/><i/><i/></div>)}</div>
        : noNearbyUsers ? <div className="bento-empty directory-empty"><Icon name="users" size={24}/><strong>No nearby experts yet</strong><span>Expand your radius to discover more community members.</span><button className="secondary-button" type="button" onClick={() => dispatch(setRadiusKm('worldwide'))}>Search worldwide</button></div>
          : filteredUsers.length === 0 ? <div className="bento-empty directory-empty"><Icon name="search" size={24}/><strong>No experts match “{query}”</strong><span>Try a broader skill or search by member name.</span></div>
            : <div className="expert-directory-grid">{filteredUsers.map((user) => <Link className="expert-directory-card lift" to={`/profile/${user._id}`} key={user._id}><div className="expert-card-head"><span className="expert-card-avatar">{initials(user.name)}</span><span><strong>{user.name}</strong><small>{user.location?.city ? `${user.location.city}${user.location.country ? `, ${user.location.country}` : ''}` : 'Global member'}</small></span><Icon name="arrow" size={16}/></div>{user.bio && <p className="expert-card-bio">{user.bio}</p>}<div className="expert-card-divider"/><small className="expert-card-label">Expertise</small><div className="expert-skill-list">{(user.skillsOffered || []).slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}{(user.skillsOffered?.length || 0) > 3 && <em>+{user.skillsOffered.length - 3} more</em>}{!user.skillsOffered?.length && <em>Profile in progress</em>}</div>{user.reviewCount > 0 && <span className="expert-rating">★ {user.averageRating} · {user.reviewCount} reviews</span>}</Link>)}</div>}
    </AppShell>
  );
}

export default Browse;
