import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import Stars from '../components/Stars';
import { formatCredits, locationLabel } from '../lib/format';
import { useDebounced, useGeolocation, useQuery } from '../lib/hooks';
import { useSkillCatalog } from '../lib/skills';
import { TEACHER_TYPE_LABEL, TIER_LABEL } from '../lib/teachers';
import { SEARCH_RADIUS_OPTIONS, setRadiusKm } from '../redux/searchRadiusSlice';

const PAGE_SIZE = 24;
const SORTS = [['recommended', 'Recommended'], ['rating', 'Top rated'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low']];
const MAX_RATES = [['', 'Any price'], ['1', 'Up to 1 credit/h'], ['2', 'Up to 2 credits/h'], ['3', 'Up to 3 credits/h'], ['5', 'Up to 5 credits/h']];

function TeacherCard({ member }) {
  const skills = member.skillsOffered || [];
  const teacher = member.teacherProfile || {};
  const rate = teacher.hourlyRateCredits ?? 1;
  return (
    <Link className="card interactive teacher-card" to={`/profile/${member._id}`}>
      <div className="row nowrap" style={{ alignItems: 'flex-start' }}>
        <Avatar name={member.name} src={member.profilePicture} size="lg" />
        <div className="grow stack" style={{ '--gap': '3px' }}>
          <span className="row nowrap" style={{ gap: 6 }}><strong className="truncate">{member.name}</strong>{member.isPro && <span className="badge pro">Pro</span>}</span>
          <span className="small muted truncate">{[teacher.jobTitle, teacher.organization].filter(Boolean).join(' · ') || TEACHER_TYPE_LABEL[teacher.teacherType] || 'Verified teacher'}</span>
          <Stars value={member.averageRating} count={member.reviewCount} />
        </div>
        <div className="rate-pill" title="Price of one hour"><strong>{formatCredits(rate)}</strong><span>credit{rate === 1 ? '' : 's'}/h</span></div>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <span className={`verified-badge ${teacher.tier === 'expert' ? 'expert' : ''}`}><Icon name="checkCircle" size={13} /> {TIER_LABEL[teacher.tier] || 'Verified'}</span>
        {teacher.teacherType && <span className="badge">{TEACHER_TYPE_LABEL[teacher.teacherType]}</span>}
        {member.institutionVerified && <span className="badge brand" title="Controls a verified university or work mailbox">Institution email</span>}
      </div>
      {teacher.headline && <p className="small clamp-2"><strong>{teacher.headline}</strong></p>}
      <div className="tags">
        {skills.slice(0, 4).map((skill) => <span className="tag brand" key={skill}>{skill}</span>)}
        {skills.length > 4 && <span className="tag">+{skills.length - 4}</span>}
      </div>
      <p className="tiny faint row" style={{ gap: 12 }}>
        <span><Icon name="pin" size={12} /> {locationLabel(member.location) || 'Online'}{member.distanceKm != null ? ` · ${member.distanceKm} km` : ''}</span>
        {member.languages?.length > 0 && <span><Icon name="globe" size={12} /> {member.languages.join(' · ')}</span>}
      </p>
    </Link>
  );
}

export default function Browse() {
  const dispatch = useDispatch();
  const radiusKm = useSelector((state) => state.searchRadius.radiusKm);
  const wanted = useSelector((state) => state.auth.user?.skillsWanted) || [];
  const { categories } = useSkillCatalog();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ category: '', skill: '', type: '', maxRate: '', sort: 'recommended' });
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const nearby = radiusKm !== 'worldwide';
  const geo = useGeolocation(nearby);
  const waitingForLocation = nearby && geo.status === 'loading';
  const locationFailed = nearby && ['denied', 'unsupported'].includes(geo.status);
  const useGeo = nearby && geo.status === 'granted';
  const skillsInCategory = useMemo(() => categories.find((item) => item.id === filters.category)?.skills || [], [categories, filters.category]);
  const filtered = Boolean(q || filters.category || filters.skill || filters.type || filters.maxRate);

  const directory = useQuery(async () => {
    const params = { limit: PAGE_SIZE, page, sort: filters.sort };
    if (q) params.q = q;
    ['category', 'skill', 'type', 'maxRate'].forEach((key) => { if (filters[key]) params[key] = filters[key]; });
    if (useGeo) Object.assign(params, { lng: geo.coords.lng, lat: geo.coords.lat, radiusKm });
    const response = await api.get('/users', { params });
    return { items: response.data, total: Number(response.headers['x-total-count'] || response.data.length) };
  }, [q, page, filters, useGeo, radiusKm, geo.coords?.lng, geo.coords?.lat], { enabled: !waitingForLocation });

  const change = (patch) => { setFilters((current) => ({ ...current, ...patch })); setPage(1); };
  const changeSearch = (value) => { setSearch(value); setPage(1); };
  const clearAll = () => { setSearch(''); setFilters({ category: '', skill: '', type: '', maxRate: '', sort: filters.sort }); setPage(1); };
  const items = directory.data?.items || [];
  const total = directory.data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const loading = directory.loading || waitingForLocation;

  return (
    <AppShell eyebrow="Discover" title="Learn tech from verified experts" description="Every teacher here was checked by hand: university lecturers, industry engineers and certified trainers. Sessions are live 1:1 video.">
      <div className="stack" style={{ '--gap': '20px' }}>
        <div className="toolbar">
          <div className="input-icon grow">
            <Icon name="search" size={18} />
            <input className="input" type="search" placeholder="Search skills, names or universities: Kubernetes, Python, MIT…" value={search} onChange={(event) => changeSearch(event.target.value)} aria-label="Search teachers" />
          </div>
          <label className="row nowrap" style={{ gap: 8 }}>
            <span className="small muted">Sort</span>
            <select className="select" style={{ width: 'auto' }} value={filters.sort} onChange={(event) => change({ sort: event.target.value })} aria-label="Sort teachers">{SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
        </div>

        <div className="toolbar filters" role="group" aria-label="Filters">
          <select className="select" value={filters.category} onChange={(event) => change({ category: event.target.value, skill: '' })} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select className="select" value={filters.skill} onChange={(event) => change({ skill: event.target.value })} aria-label="Skill" disabled={!filters.category}>
            <option value="">{filters.category ? 'Any skill in category' : 'Pick a category first'}</option>
            {skillsInCategory.map((skill) => <option key={skill} value={skill}>{skill}</option>)}
          </select>
          <select className="select" value={filters.type} onChange={(event) => change({ type: event.target.value })} aria-label="Qualification">
            <option value="">Any qualification</option>
            {Object.entries(TEACHER_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="select" value={filters.maxRate} onChange={(event) => change({ maxRate: event.target.value })} aria-label="Maximum price">{MAX_RATES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select className="select" value={radiusKm} onChange={(event) => { setPage(1); dispatch(setRadiusKm(event.target.value === 'worldwide' ? 'worldwide' : Number(event.target.value))); }} aria-label="Distance">
            {SEARCH_RADIUS_OPTIONS.map((option) => <option key={option} value={option}>{option === 'worldwide' ? 'Anywhere (online)' : `Within ${option} km`}</option>)}
          </select>
          {filtered && <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>Clear filters</button>}
        </div>

        {wanted.length > 0 && (
          <div className="row" style={{ gap: 8 }} aria-label="Your learning goals">
            <span className="small muted">Your goals:</span>
            {wanted.slice(0, 6).map((skill) => <button type="button" key={skill} className={`tag chip-button ${filters.skill === skill ? 'brand' : ''}`} aria-pressed={filters.skill === skill} onClick={() => change({ skill: filters.skill === skill ? '' : skill, category: '' })}>{skill}</button>)}
          </div>
        )}

        {locationFailed && <p className="alert warning" role="status"><Icon name="info" /> We could not get your location, so you are seeing teachers from anywhere. Allow location access in your browser to filter by distance.</p>}
        {directory.error && <p className="alert error" role="alert">{directory.error.response?.data?.message || 'We could not load the directory right now.'} <button type="button" className="btn btn-sm btn-secondary" onClick={directory.reload}>Retry</button></p>}

        <p className="small muted" aria-live="polite">{loading ? 'Searching…' : `${total} verified ${total === 1 ? 'teacher' : 'teachers'}${q ? ` for “${q}”` : ''}${useGeo ? ` within ${radiusKm} km` : ''}`}</p>

        {loading ? <div className="grid auto">{[1, 2, 3, 4, 5, 6].map((n) => <div className="skeleton" style={{ height: 250 }} key={n} />)}</div>
          : items.length === 0 ? (
            <div className="card"><EmptyState icon="search" title={filtered ? 'No verified teacher matches yet' : 'No teachers yet'}
              action={filtered ? <button type="button" className="btn btn-secondary" onClick={clearAll}>Clear filters</button> : <Link className="btn btn-secondary" to="/teach">Become a teacher</Link>}>
              {filtered ? 'Try a broader skill, a higher price limit, or search anywhere. Sessions are online, so distance does not matter.' : 'Verified teachers will appear here as soon as they are approved.'}
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
