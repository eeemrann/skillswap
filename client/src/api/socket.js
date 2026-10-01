import { io } from 'socket.io-client';
import { apiOrigin } from './axios';

let socket = null;

/**
 * One shared, authenticated realtime connection. The token is requested again
 * on every (re)connect so an expired Clerk session token never sticks.
 */
export function connectSocket(getToken) {
  if (socket) return socket;
  socket = io(apiOrigin, {
    auth: async (callback) => {
      try { callback({ token: await getToken() }); } catch { callback({ token: null }); }
    },
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 5000
  });
  return socket;
}

export const getSocket = () => socket;

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
