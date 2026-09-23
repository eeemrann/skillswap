import { createSlice } from '@reduxjs/toolkit';

export const SEARCH_RADIUS_OPTIONS = [25, 50, 100, 200, 400, 'worldwide'];

const searchRadiusSlice = createSlice({
  name: 'searchRadius',
  initialState: { radiusKm: 25 },
  reducers: {
    setRadiusKm: (state, action) => {
      if (SEARCH_RADIUS_OPTIONS.includes(action.payload)) state.radiusKm = action.payload;
    }
  }
});

export const { setRadiusKm } = searchRadiusSlice.actions;
export default searchRadiusSlice.reducer;
