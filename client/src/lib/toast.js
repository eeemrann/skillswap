import { createContext, useContext, useMemo } from 'react';

export const ToastContext = createContext({ push: () => {} });

/** `const toast = useToast(); toast.success('Saved')`. The returned object is stable across renders. */
export function useToast() {
  const { push } = useContext(ToastContext);
  return useMemo(() => ({
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    info: (message) => push('info', message)
  }), [push]);
}
