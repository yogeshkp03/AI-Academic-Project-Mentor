import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';
import { Button } from './Button';

/* ==========================================================================
   Modal — replaces window.confirm / window.prompt
   ========================================================================== */
export function Modal({ open, onClose, title, description, icon: Icon, children, footer, width = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="animate-fade-in absolute inset-0 cursor-pointer border-none bg-brand-900/35 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'animate-pop relative w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-4',
          widths[width],
        )}
      >
        {(Icon || title) && (
          <header className="flex items-start gap-3.5 px-6 pt-5 pb-4">
            {Icon && (
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-subtle text-ink-soft">
                <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {title && <h2 className="text-[17px] font-semibold text-ink">{title}</h2>}
              {description && (
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{description}</p>
              )}
            </div>
          </header>
        )}
        {children && <div className="px-6 pb-2">{children}</div>}
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Confirm dialog — the standard destructive-action gate. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  icon: Icon,
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={Icon}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

/* ==========================================================================
   Tooltip — for icon-only controls
   ========================================================================== */
export function Tooltip({ label, children, side = 'bottom', className }) {
  return (
    <span className={cn('group/tt relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 scale-95 whitespace-nowrap rounded-md bg-brand-900 px-2 py-1 text-[11px] font-semibold text-ink-inverse opacity-0 shadow-2 transition-all duration-150 group-hover/tt:scale-100 group-hover/tt:opacity-100',
          side === 'bottom' && 'top-[calc(100%+6px)]',
          side === 'top' && 'bottom-[calc(100%+6px)]',
          side === 'right' && 'top-1/2 left-[calc(100%+6px)] -translate-y-1/2',
        )}
      >
        {label}
      </span>
    </span>
  );
}
