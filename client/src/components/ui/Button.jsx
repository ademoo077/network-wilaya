import { forwardRef } from 'react';
import { LoaderCircle } from 'lucide-react';

const variants = {
  primary: 'bg-brand-700 text-brand-50 hover:bg-brand-800 border-brand-700',
  secondary: 'bg-surface text-ink hover:bg-surface2 border-border',
  ghost: 'bg-transparent text-ink hover:bg-surface2 border-transparent',
  danger: 'bg-danger text-surface hover:opacity-90 border-danger',
};
const sizes = {
  sm: 'min-h-11 px-3 text-xs',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
};

export const Button = forwardRef(function Button({
  children, variant = 'primary', size = 'md', loading = false, disabled = false, className = '', type = 'button', as: Tag = 'button', ...props
}, ref) {
  return (
    <Tag
      ref={ref}
      type={Tag === 'button' ? type : undefined}
      disabled={Tag === 'button' ? loading || disabled : undefined}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition duration-200 ease-ease active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </Tag>
  );
});

export const IconButton = forwardRef(function IconButton({ children, className = '', ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={`inline-grid h-11 w-11 shrink-0 place-items-center rounded-md border border-transparent text-ink transition hover:border-border hover:bg-surface2 active:scale-[.98] disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
