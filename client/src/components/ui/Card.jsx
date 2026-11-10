export function Card({ children, className = '', as: Tag = 'section', ...props }) {
  return <Tag data-card className={`min-w-0 self-start rounded-lg border border-border bg-surface shadow-1 ${className}`} {...props}>{children}</Tag>;
}

export function CardHeader({ title, description, action, className = '', children }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 ${className}`}>
      <div className="min-w-0">
        {title && <h2 className="text-base font-bold text-ink"><bdi>{title}</bdi></h2>}
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
