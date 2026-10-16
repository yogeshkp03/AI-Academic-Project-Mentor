import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { cn } from './cn';
import { ToastContext } from './toastContext';

/* ==========================================================================
   Toast — transient confirmations. Sits above everything, bottom-centre.
   ========================================================================== */
const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
};

const TOAST_TONES = {
  success: 'border-success-100 bg-success-50 text-success-700',
  error: 'border-danger-100 bg-danger-50 text-danger-700',
  warning: 'border-warning-100 bg-warning-50 text-warning-700',
  info: 'border-info-100 bg-info-50 text-info-600',
};

const TOAST_ICON_TONES = {
  success: 'text-success-500',
  error: 'text-danger-500',
  warning: 'text-warning-500',
  info: 'text-info-500',
};

/** The live region. Always mounted so toasts animate in and out. */
function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-100 flex flex-col items-center gap-2 p-4 sm:items-end"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const Icon = TOAST_ICONS[toast.type] || Info;
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'animate-pop pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-3 backdrop-blur-sm',
              TOAST_TONES[toast.type],
            )}
          >
            <Icon
              size={17}
              strokeWidth={2.25}
              className={cn('mt-px shrink-0', TOAST_ICON_TONES[toast.type])}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              {toast.title && <p className="text-[13px] font-semibold text-ink">{toast.title}</p>}
              <p className={cn('text-[13px] leading-relaxed', toast.title && 'mt-0.5')}>
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="-mt-0.5 -mr-1 cursor-pointer rounded-md p-1 text-ink-faint transition-colors hover:bg-black/5 hover:text-ink-soft"
              aria-label="Dismiss"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((current) => [...current.slice(-3), { id, type: 'info', ...toast }]);
      const ttl = toast.duration ?? 3600;
      if (ttl > 0) window.setTimeout(() => dismiss(id), ttl);
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      push,
      dismiss,
      success: (message, title) => push({ type: 'success', message, title }),
      error: (message, title) => push({ type: 'error', message, title }),
      warning: (message, title) => push({ type: 'warning', message, title }),
      info: (message, title) => push({ type: 'info', message, title }),
    }),
    [push, dismiss],
  );

  // Close the newest toast on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setToasts((c) => c.slice(0, -1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(<ToastViewport toasts={toasts} onDismiss={dismiss} />, document.body)}
    </ToastContext.Provider>
  );
}
