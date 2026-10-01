import { useCallback, useMemo, useRef, useState } from 'react';
import { ToastContext } from '../lib/toast';
import Icon from './Icon';

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const push = useCallback((kind, message) => {
    const id = nextId.current++;
    setToasts((items) => [...items.slice(-3), { id, kind, message }]);
    window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4500);
  }, [dismiss]);
  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div className={`toast ${toast.kind}`} key={toast.id} role={toast.kind === 'error' ? 'alert' : 'status'}>
            <span>{toast.message}</span>
            <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss"><Icon name="close" size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
