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

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the token is invalid/expired, clear it and send the user back to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
