import { useState } from 'react';
import { applyTheme, resolveTheme, setThemePreference } from '../lib/theme';
import Icon from './Icon';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => resolveTheme());
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemePreference(next);
    applyTheme(next);
    setTheme(next);
  };
  return (
    <button type="button" className="btn btn-ghost btn-icon" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title="Toggle theme">
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}
