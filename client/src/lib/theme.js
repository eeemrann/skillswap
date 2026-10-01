const STORAGE_KEY = 'skillswap-theme';

const read = () => {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
};

/** 'light' | 'dark' | 'system' */
export const getThemePreference = () => read() || 'system';

export const resolveTheme = (preference = getThemePreference()) => (
  preference === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : preference
);

export function applyTheme(preference = getThemePreference()) {
  document.documentElement.dataset.theme = resolveTheme(preference);
}

export function setThemePreference(preference) {
  try { localStorage.setItem(STORAGE_KEY, preference); } catch { /* storage unavailable */ }
  applyTheme(preference);
}
