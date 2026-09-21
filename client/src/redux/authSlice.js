import { createSlice } from '@reduxjs/toolkit';

const storedUser = sessionStorage.getItem('user');

const normalize = (user) => ({ ...user, id: user.id || user._id });

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: storedUser ? normalize(JSON.parse(storedUser)) : null,
    token: sessionStorage.getItem('token') || null
  },
  reducers: {
    setCredentials: (state, action) => {
      const user = normalize(action.payload.user);
      state.user = user;
      state.token = action.payload.token;
      sessionStorage.setItem('token', action.payload.token);
      sessionStorage.setItem('user', JSON.stringify(user));
    },
    updateUser: (state, action) => {
      const user = normalize(action.payload);
      state.user = user;
      sessionStorage.setItem('user', JSON.stringify(user));
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
    }
  }
});

export const { setCredentials, updateUser, logout } = authSlice.actions;
export default authSlice.reducer;
