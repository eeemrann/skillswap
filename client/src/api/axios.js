import axios from 'axios';

const configuredApiUrl = import.meta.env.VITE_API_URL;
const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
export const apiBaseUrl = configuredApiUrl || (isLocalHost ? 'http://localhost:5000/api' : '/api');

/** Origin of the API server, used for the realtime socket. */
export const apiOrigin = new URL(apiBaseUrl, window.location.origin).origin;

const api = axios.create({ baseURL: apiBaseUrl, timeout: 30000 });

let clerkTokenGetter = null;
export const setClerkTokenGetter = (getter) => {
  clerkTokenGetter = typeof getter === 'function' ? getter : null;
};

api.interceptors.request.use(async (config) => {
  if (clerkTokenGetter) {
    try {
      const token = await clerkTokenGetter();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      console.warn('[API] Could not get a session token:', error.message);
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    // A session token can expire between being issued and being verified; retry once with a fresh one.
    if (response?.status === 401 && config && !config._retried && clerkTokenGetter) {
      config._retried = true;
      try {
        const token = await clerkTokenGetter({ skipCache: true });
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          return api(config);
        }
      } catch { /* fall through to the original error */ }
    }
    // Plan limits and empty wallets are revenue moments: let the UI offer an upgrade or top-up.
    if (response?.status === 402) {
      window.dispatchEvent(new CustomEvent('skillswap:payment-required', { detail: { message: response.data?.message, ...response.data } }));
    }
    return Promise.reject(error);
  }
);

export default api;
