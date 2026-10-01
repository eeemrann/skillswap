import { initials } from '../lib/format';

export default function Avatar({ name, src, size = '', className = '' }) {
  return (
    <span className={`avatar ${size} ${className}`} role="img" aria-label={name || 'Member'}>
      {src ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" /> : initials(name)}
    </span>
  );
}
