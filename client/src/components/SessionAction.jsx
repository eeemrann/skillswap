import { Link } from 'react-router-dom';
import { countdown, joinState } from '../lib/booking';
import Icon from './Icon';

/** Primary action for a confirmed session: join when the room is open, otherwise a countdown. */
export default function SessionAction({ booking, now, size = '' }) {
  const state = joinState(booking, now);
  if (state.phase === 'open') {
    return <Link className={`btn btn-primary ${size}`} to={`/session/${booking._id}`}><Icon name="video" size={16} />{state.live ? 'Join now' : 'Enter room'}</Link>;
  }
  if (state.phase === 'upcoming') {
    return <Link className={`btn btn-secondary ${size}`} to={`/session/${booking._id}`} title="Open the lobby to test your camera"><Icon name="clock" size={16} />Starts in {countdown(state.startsInMs)}</Link>;
  }
  return null;
}
