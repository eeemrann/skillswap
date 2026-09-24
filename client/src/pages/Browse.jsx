import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Icon from '../components/Icon';
import { SEARCH_RADIUS_OPTIONS, setRadiusKm } from '../redux/searchRadiusSlice';

const initials = (name = '') => name
  .split(' ')
  .filter(Boolean)
  .map((part) => part[0])
  .join('')
  .slice(0, 2)
  .toUpperCase();

const getCurrentPosition = () => new Promise((resolve, reject) => {
  navigator.geolocation.getCurrentPosition(resolve, reject, {
    enableHighAccuracy: false,
    maximumAge: 5 * 60 * 1000,
    timeout: 8000,
  });
});

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

        if (radiusKm !== 'worldwide' && navigator.geolocation) {
          try {
            const position = await getCurrentPosition();
            const { latitude, longitude } = position.coords;
            params.set('lng', String(longitude));
            params.set('lat', String(latitude));
            setLocationActive(true);

            api.patch('/users/me/location', {
              coordinates: [longitude, latitude],
            }).catch(() => {});
          } catch {
            setLocationActive(false);
          }
        } else {
          setLocationActive(true);
        }

        const response = await api.get(`/users?${params.toString()}`);
        if (!active) return;

        const nextUsers = Array.isArray(response.data)
          ? response.data
          : response.data?.users || [];
        const usedLocationFallback = response.headers?.['x-location-fallback'] === 'true';

        setUsers(nextUsers);
        if (usedLocationFallback) setLocationActive(false);
        setNoNearbyUsers(radiusKm !== 'worldwide' && nextUsers.length === 0);
      } catch (requestError) {
        if (!active) return;
        console.error('Directory sync failed', requestError);
        setError('Directory sync failed. Retry the query in a moment.');
        setUsers([]);
      } finally {
        if (active) setLoading(false);
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

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return users;

    return users.filter((user) => {
      const offered = Array.isArray(user.skillsOffered) ? user.skillsOffered : [];
      const wanted = Array.isArray(user.skillsWanted) ? user.skillsWanted : [];
      return (user.name || '').toLowerCase().includes(normalizedQuery)
        || offered.some((skill) => skill.toLowerCase().includes(normalizedQuery))
        || wanted.some((skill) => skill.toLowerCase().includes(normalizedQuery));
    });
  }, [users, query]);

  const showWorldwide = () => dispatch(setRadiusKm('worldwide'));

  const radiusControl = (
    <label className="foundry-select-wrapper">
      <Icon name="search" size={12} aria-hidden="true" />
      <span>RADIUS:</span>
      <select
        aria-label="Search radius"
        value={radiusKm}
        onChange={(event) => dispatch(setRadiusKm(
          event.target.value === 'worldwide' ? 'worldwide' : Number(event.target.value),
        ))}
      >
        {SEARCH_RADIUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option === 'worldwide' ? 'WORLDWIDE' : `${option}KM`}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <AppShell
      eyebrow="GLOBAL_EXCHANGE_DIRECTORY"
      title="Discover Peers"
      description="Query verified expertise across the SkillSwap network."
      action={radiusControl}
    >
      <div className="foundry-search-container page-enter">
        <span className="foundry-search-icon" aria-hidden="true">
          <Icon name="search" size={20} />
        </span>
        <input
          className="foundry-search-input"
          type="search"
          aria-label="Search experts by name or expertise"
          placeholder="SEARCH_BY_NAME_OR_EXPERTISE..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <button
            type="button"
            className="foundry-search-clear"
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >
            CLEAR
          </button>
        )}
      </div>

      <div className="foundry-directory-meta" aria-live="polite">
        <span>ENTRIES_FOUND: {loading ? 'SYNCING' : filtered.length}</span>
        <span className={locationActive ? 'location-online' : 'location-fallback'}>
          {radiusKm === 'worldwide'
            ? 'SCOPE: GLOBAL'
            : locationActive
              ? `SCOPE: ${radiusKm}KM / GEO_ACTIVE`
              : 'SCOPE: FALLBACK / LOCATION_UNAVAILABLE'}
        </span>
      </div>

      {error && <div className="status-message error" role="alert">{error}</div>}

      {loading ? (
        <div className="foundry-directory-grid" aria-label="Loading directory">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="foundry-card foundry-directory-loading" />
          ))}
        </div>
      ) : noNearbyUsers ? (
        <div className="foundry-directory-empty page-enter">
          <span className="mono-label">ZERO_LOCAL_SIGNALS</span>
          <h2>No peers detected in this radius.</h2>
          <p>Expand the directory scope to search the global expertise network.</p>
          <button type="button" className="primary-button" onClick={showWorldwide}>
            Switch to Worldwide
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="foundry-directory-empty page-enter">
          <span className="mono-label">QUERY_RETURNED_ZERO</span>
          <h2>No matching personnel found.</h2>
          <p>Adjust the name or expertise query and run the search again.</p>
          <button type="button" className="secondary-button" onClick={() => setQuery('')}>
            Clear Query
          </button>
        </div>
      ) : (
        <div className="foundry-directory-grid page-enter">
          {filtered.map((user) => {
            const userId = user._id || user.id;
            const name = user.name || 'Unknown member';
            const skills = Array.isArray(user.skillsOffered) ? user.skillsOffered : [];

            return (
              <Link to={`/profile/${userId}`} key={userId} className="expert-card-foundry">
                <div className="avatar-foundry">{initials(name) || 'SS'}</div>

                <div className="foundry-expert-body">
                  <h3>{name}</h3>
                  <p className="foundry-expert-meta">
                    {(user.location?.city || 'GLOBAL_ZONE').toUpperCase()} // {user.reviewCount || 0}_REVIEWS
                  </p>
                  <p className="foundry-expert-bio">
                    {user.bio || 'NO_BIO_AVAILABLE'}
                  </p>
                </div>

                <div className="foundry-expert-skills">
                  {skills.slice(0, 2).map((skill) => (
                    <span key={skill} className="foundry-tag">{skill}</span>
                  ))}
                  {skills.length > 2 && (
                    <span className="foundry-tag-count">+{skills.length - 2}</span>
                  )}
                  {skills.length === 0 && <span className="foundry-tag">UNSPECIFIED</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

export default Browse;
