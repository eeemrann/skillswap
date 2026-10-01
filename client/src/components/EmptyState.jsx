import Icon from './Icon';

export default function EmptyState({ icon = 'spark', title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={24} /></span>
      <strong>{title}</strong>
      {children && <p style={{ maxWidth: 380 }}>{children}</p>}
      {action}
    </div>
  );
}
