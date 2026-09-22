import axios from 'axios';

const localApiUrl = 'http://localhost:5000/api';
const productionApiUrl = 'https://skillswap-1-x54c.onrender.com/api';

// Vercel builds do not have access to the developer's localhost. Keep local
// development convenient while making an existing production build usable.
const configuredApiUrl = import.meta.env.VITE_API_URL;
const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const apiBaseUrl = configuredApiUrl || (isLocalHost ? localApiUrl : productionApiUrl);

const api = axios.create({
  baseURL: apiBaseUrl
});

let clerkTokenGetter = null;
export const setClerkTokenGetter = (getter) => {
  clerkTokenGetter = typeof getter === 'function' ? getter : null;
};
// Backward-compatible alias for existing imports.
export const bindClerkTokenGetter = setClerkTokenGetter;

api.interceptors.request.use(async (config) => {
  let token = null;
  if (clerkTokenGetter) {
    try {
      token = await clerkTokenGetter();
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
        console.warn('[Axios] Failed to get session token:', error.message);
    }
  }
  // TEMP AUTH DEBUG: remove after diagnosing intermittent 401 responses.
  console.log('[Auth Debug]', config.url, 'token:', token ? `${token.slice(0, 20)}...` : 'MISSING');
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const message = error.response?.data?.message || error.message;
    console.warn(`[API ${error.config?.method?.toUpperCase()} ${error.config?.url}]`, message);
    const config = error.config;
    if (error.response?.status === 401 && config && !config._retried && clerkTokenGetter) {
      config._retried = true;
      try {
        const token = await clerkTokenGetter();
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
          return api(config);
        }
      } catch (tokenError) {
        console.warn('[Axios] Failed to refresh session token:', tokenError.message);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
