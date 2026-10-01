import { createSlice } from '@reduxjs/toolkit';

const CACHE_KEY = 'user';

const normalize = (user) => ({ ...user, id: user.id || user._id });

const readCache = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

const writeCache = (user) => {
  try {
    if (user) sessionStorage.setItem(CACHE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(CACHE_KEY);
  } catch { /* storage unavailable */ }
};

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: readCache() },
  reducers: {
    updateUser: (state, action) => {
      state.user = normalize(action.payload);
      writeCache(state.user);
    },
    logout: (state) => {
      state.user = null;
      writeCache(null);
    }
  }
});

export const { updateUser, logout } = authSlice.actions;
export default authSlice.reducer;
