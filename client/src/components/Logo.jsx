import { Link } from 'react-router-dom';

export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="ss-logo" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5b5bf0" /><stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#ss-logo)" />
      <path d="M9 12h12l-3-3M23 20H11l3 3" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo({ to = '/', compact = false, className = '' }) {
  return (
    <Link to={to} className={`logo ${className}`} aria-label="SkillSwap home">
      <LogoMark />
      {!compact && <span className="logo-word">Skill<b>Swap</b></span>}
    </Link>
  );
}
