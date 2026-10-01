import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../redux/notificationSlice';
import { formatRelative } from '../lib/format';
import { useEscape } from '../lib/hooks';
import Icon from './Icon';

const ICONS = { booking: 'calendar', message: 'message', review: 'star', credit: 'wallet', session: 'video', billing: 'card' };

const destination = (notification) => {
  if (notification.type === 'session') return `/session/${notification.relatedId}`;
  if (notification.type === 'message') return '/messages';
  if (notification.type === 'credit' || notification.type === 'billing') return '/billing';
  return '/bookings';
};

export default function NotificationBell() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, counts, loading } = useSelector((state) => state.notifications);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  useEscape(open, () => setOpen(false));

  useEffect(() => {
    if (!open) return undefined;
    dispatch(fetchNotifications());
    const onPointerDown = (event) => { if (!containerRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, dispatch]);

  const openItem = (notification) => {
    if (!notification.read) dispatch(markNotificationRead(notification._id));
    setOpen(false);
    navigate(destination(notification));
  };

  return (
    <div className="popover-host" ref={containerRef}>
      <button type="button" className="btn btn-ghost btn-icon" onClick={() => setOpen((value) => !value)} aria-label={`Notifications${counts.all ? `, ${counts.all} unread` : ''}`} aria-expanded={open}>
        <Icon name="bell" />
        {counts.all > 0 && <span className="dot-badge">{counts.all > 9 ? '9+' : counts.all}</span>}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Notifications">
          <div className="popover-head">
            <strong>Notifications</strong>
            {counts.all > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch(markAllNotificationsRead())}>Mark all read</button>}
          </div>
          <div className="popover-body">
            {loading && !items.length && <div className="skeleton" style={{ height: 56, margin: 12 }} />}
            {!loading && !items.length && <p className="empty small">You are all caught up.</p>}
            {items.map((notification) => (
              <button type="button" className={`notice ${notification.read ? '' : 'unread'}`} key={notification._id} onClick={() => openItem(notification)}>
                <span className="notice-icon"><Icon name={ICONS[notification.type] || 'bell'} size={16} /></span>
                <span className="grow stack" style={{ '--gap': '2px', textAlign: 'left' }}>
                  <span className="small">{notification.message}</span>
                  <span className="tiny faint">{formatRelative(notification.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
