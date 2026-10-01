import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../api/axios';

const emptyCounts = { all: 0, booking: 0, message: 0, review: 0, credit: 0, session: 0, billing: 0 };

export const fetchUnreadCounts = createAsyncThunk('notifications/fetchCounts', async () => {
  const response = await api.get('/notifications/unread-count');
  return response.data;
});

export const fetchNotifications = createAsyncThunk('notifications/fetchAll', async () => {
  const response = await api.get('/notifications', { params: { limit: 30 } });
  return response.data;
});

export const markNotificationRead = createAsyncThunk('notifications/markOne', async (id) => {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data;
});

export const markNotificationTypeRead = createAsyncThunk('notifications/markType', async (type, { dispatch }) => {
  await api.patch('/notifications/read', { type });
  dispatch(fetchUnreadCounts());
  return type;
});

export const markAllNotificationsRead = createAsyncThunk('notifications/markAll', async (_, { dispatch }) => {
  await api.patch('/notifications/read', {});
  dispatch(fetchUnreadCounts());
});

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: { items: [], counts: emptyCounts, loading: false },
  reducers: { clearNotifications: (state) => { state.items = []; state.counts = emptyCounts; } },
  extraReducers: (builder) => builder
    .addCase(fetchUnreadCounts.fulfilled, (state, action) => { state.counts = action.payload; })
    .addCase(fetchNotifications.pending, (state) => { state.loading = true; })
    .addCase(fetchNotifications.fulfilled, (state, action) => { state.items = action.payload; state.loading = false; })
    .addCase(fetchNotifications.rejected, (state) => { state.loading = false; })
    .addCase(markNotificationRead.fulfilled, (state, action) => {
      const item = state.items.find((notification) => notification._id === action.payload._id);
      if (item && !item.read) {
        item.read = true;
        state.counts.all = Math.max(0, state.counts.all - 1);
        state.counts[item.type] = Math.max(0, (state.counts[item.type] || 0) - 1);
      }
    })
    .addCase(markNotificationTypeRead.fulfilled, (state, action) => {
      state.items.forEach((item) => { if (item.type === action.payload) item.read = true; });
    })
    .addCase(markAllNotificationsRead.fulfilled, (state) => {
      state.items.forEach((item) => { item.read = true; });
    })
});

export const { clearNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;
