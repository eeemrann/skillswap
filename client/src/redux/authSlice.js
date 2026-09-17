import { createSlice } from '@reduxjs/toolkit';

const storedUser = localStorage.getItem('user');

const normalize = (user) => ({ ...user, id: user.id || user._id });

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: localStorage.getItem('token') || null
  },
  reducers: {
    setCredentials: (state, action) => {
      const user = normalize(action.payload.user);
      state.user = user;
      state.token = action.payload.token;
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    updateUser: (state, action) => {
      const user = normalize(action.payload);
      state.user = user;
      localStorage.setItem('user', JSON.stringify(user));
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
});

export const { setCredentials, updateUser, logout } = authSlice.actions;
export default authSlice.reducer;