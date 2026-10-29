import { forwardRef } from 'react';

const variants = {
  primary: 'bg-[var(--brand-600)] text-white hover:bg-[var(--brand-700)]',
  secondary: 'bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border)] hover:bg-[var(--brand-50)]',
  ghost: 'bg-transparent text-[var(--ink-2)] hover:bg-[var(--brand-50)]',
  danger: 'bg-[var(--st-non)] text-white hover:opacity-90',
};

const sizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', loading = false, className = '', children, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--r-md)] font-medium transition-all duration-150 active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
});

export const IconButton = forwardRef(function IconButton({ className = '', children, ...props }, ref) {
  return (
    <button ref={ref} className={`inline-flex items-center justify-center w-11 h-11 rounded-[var(--r-md)] hover:bg-[var(--brand-50)] transition-colors ${className}`} {...props}>
      {children}
    </button>
  );
});