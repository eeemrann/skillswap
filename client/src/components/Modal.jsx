import { useEffect, useId, useRef } from 'react';
import { useEscape, useScrollLock } from '../lib/hooks';
import Icon from './Icon';

/** Accessible dialog: focus moves in, Escape/backdrop close it, scroll is locked, Tab stays inside. */
export default function Modal({ open, onClose, title, description, children, wide = false, dismissible = true }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  useScrollLock(open);
  useEscape(open && dismissible, onClose);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = () => [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')];
    (focusable()[0] || dialog).focus();
    const trap = (event) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener('keydown', trap);
    return () => { dialog.removeEventListener('keydown', trap); previouslyFocused?.focus?.(); };
  }, [open]);

  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(event) => { if (dismissible && event.target === event.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialogRef}>
        <div className="modal-head">
          <div className="stack" style={{ '--gap': '4px' }}>
            <h2 id={titleId} style={{ fontSize: 22 }}>{title}</h2>
            {description && <p className="muted">{description}</p>}
          </div>
          {dismissible && <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><Icon name="close" /></button>}
        </div>
        {children}
      </div>
    </div>
  );
}
