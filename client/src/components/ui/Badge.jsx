const tone = {
  non_traite: 'bg-[var(--st-non-bg)] text-[var(--st-non)]',
  en_cours: 'bg-[var(--st-cours-bg)] text-[var(--st-cours)]',
  traite: 'bg-[var(--st-traite-bg)] text-[var(--st-traite)]',
  default: 'bg-[var(--surface-2)] text-[var(--ink-2)]',
};

export function Badge({ tone: t = 'default', className = '', children }) {
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${tone[t] || tone.default} ${className}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const label = status === 'non_traite' ? 'Non traité' : status === 'en_cours' ? 'En cours' : 'Traité';
  const icon = status === 'non_traite' ? '●' : status === 'en_cours' ? '◐' : '✓';
  return <Badge tone={status}><span aria-hidden>{icon}</span> {label}</Badge>;
}

export function PriorityBadge({ priority }) {
  const color = priority === 'urgente' ? 'text-[var(--st-non)]' : priority === 'haute' ? 'text-[var(--st-cours)]' : 'text-[var(--muted)]';
  return <span className={`text-xs font-medium ${color}`}>{priority}</span>;
}