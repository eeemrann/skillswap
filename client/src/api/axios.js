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
  if (clerkTokenGetter) {
    try {
      const token = await clerkTokenGetter();
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('[Axios] Failed to acquire Clerk session token:', error);
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default api;
