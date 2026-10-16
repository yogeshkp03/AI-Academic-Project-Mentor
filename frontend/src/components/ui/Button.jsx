import { cn } from '../ui/cn';

/* ==========================================================================
   Button — 5 variants, 3 sizes, icon slots, press feedback
   ========================================================================== */
const VARIANTS = {
  primary:
    'bg-brand-600 text-white shadow-brand hover:bg-brand-700 active:bg-brand-800',
  secondary:
    'bg-surface text-ink-soft border border-line-strong hover:bg-subtle hover:border-ink-faint active:bg-subtle-strong',
  subtle: 'bg-transparent text-ink-soft hover:bg-subtle active:bg-subtle-strong',
  accent:
    'bg-ochre-400 text-brand-900 shadow-ochre hover:bg-ochre-300 active:bg-ochre-500 font-bold',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 shadow-1',
  ghostDanger: 'bg-transparent text-danger-600 hover:bg-danger-50 active:bg-danger-100',
};

const SIZES = {
  xs: 'h-7 px-2.5 text-[12px] gap-1.5 rounded-[7px]',
  sm: 'h-8.5 px-3.5 text-[13px] gap-2 rounded-[9px]',
  md: 'h-10 px-4.5 text-[14px] gap-2 rounded-[10px]',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-xl',
};

const ICON_SIZES = { xs: 12, sm: 14, md: 15, lg: 16 };

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap',
        'transition-[background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out',
        'cursor-pointer select-none active:scale-[0.985]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? (
        <Spinner className={ICON_SIZES[size]} />
      ) : (
        Icon && <Icon size={ICON_SIZES[size]} strokeWidth={2.25} aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight size={ICON_SIZES[size]} strokeWidth={2.25} aria-hidden="true" />}
    </button>
  );
}

/* ==========================================================================
   Spinner
   ========================================================================== */
export function Spinner({ className = '', size = 16 }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2.4" opacity="0.22" />
      <path
        d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ==========================================================================
   ButtonLink — same visual language, renders as a router link
   ========================================================================== */
export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  children,
  ...props
}) {
  const classes = cn(
    'inline-flex items-center justify-center font-semibold whitespace-nowrap no-underline',
    'transition-[background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out',
    'cursor-pointer select-none active:scale-[0.985]',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
    className,
  );
  // Works whether the caller passes a router Link or an anchor
  const Tag = props.href ? 'a' : LinkShim;
  return (
    <Tag to={to} className={classes} {...props}>
      {children}
    </Tag>
  );
}

import { Link as LinkShim } from 'react-router-dom';
