import { createContext, useContext } from 'react';

/** Toast context lives apart from the view so fast-refresh stays happy. */
export const ToastContext = createContext(null);

/** Access the toast API. Must be used inside <ToastProvider>. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
