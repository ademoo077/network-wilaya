export function Card({ className = '', children }) {
  return <div className={`bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] ${className}`}>{children}</div>;
}

export function CardHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)] ${className}`}>
      <div>
        {title && <h3 className="text-base font-semibold text-[var(--ink)]">{title}</h3>}
        {subtitle && <p className="text-sm text-[var(--muted)] mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className = '', children }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}