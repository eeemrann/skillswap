import { createSlice } from '@reduxjs/toolkit';

// Sessions are online, so discovery defaults to the whole world; a radius is an optional filter.
export const SEARCH_RADIUS_OPTIONS = ['worldwide', 25, 50, 100, 200, 400];

const searchRadiusSlice = createSlice({
  name: 'searchRadius',
  initialState: { radiusKm: 'worldwide' },
  reducers: {
    setRadiusKm: (state, action) => {
      if (SEARCH_RADIUS_OPTIONS.includes(action.payload)) state.radiusKm = action.payload;
    }
  }
});

export const { setRadiusKm } = searchRadiusSlice.actions;
export default searchRadiusSlice.reducer;
