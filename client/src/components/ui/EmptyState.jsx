export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      {icon && <div className="mb-4 text-[var(--brand-600)] opacity-80">{icon}</div>}
      {title && <h3 className="text-lg font-semibold text-[var(--ink)]">{title}</h3>}
      {description && <p className="text-sm text-[var(--muted)] mt-1 max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-[var(--surface-2)] rounded-[var(--r-md)] ${className}`} />;
}

export function KpiCard({ label, value, icon, trend, sparkline, className = '' }) {
  return (
    <div className={`bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-[var(--muted)]">{label}</span>
        {icon && <span className="text-[var(--brand-600)]">{icon}</span>}
      </div>
      <div className="text-3xl font-bold text-[var(--ink)] tabular-nums">{value}</div>
      {trend !== undefined && (
        <div className={`text-xs mt-1 ${trend >= 0 ? 'text-[var(--st-traite)]' : 'text-[var(--st-non)]'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
        </div>
      )}
      {sparkline && <div className="mt-2 h-8">{sparkline}</div>}
    </div>
  );
}

export function Pagination({ page, totalPages, total, pageSize, onPage, onPageSize }) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[var(--ink-2)]">
      <div>{total} résultats</div>
      <div className="flex items-center gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="px-3 py-1.5 rounded border border-[var(--border)] disabled:opacity-40">Précédent</button>
        <span className="px-2">{page} / {totalPages || 1}</span>
        <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="px-3 py-1.5 rounded border border-[var(--border)] disabled:opacity-40">Suivant</button>
        {onPageSize && (
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className="h-9 rounded border border-[var(--border)] bg-[var(--surface)] px-2">
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}