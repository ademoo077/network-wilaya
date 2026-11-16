/** Badge générique (jeton d’étiquette) sans configuration de statut. Utilise uniquement des tokens. */
export function Chip({ children, className = '', variant = 'secondaire' }) {
  const base = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold border border-border';
  const variantes = {
    secondaire: 'bg-surface2 text-ink2',
    outline: 'bg-transparent text-ink2',
    fantome: 'bg-transparent text-muted',
    primaire: 'bg-brand-700 text-brand-50 border-brand-700',
  };
  return <span className={`${base} ${variantes[variant] ?? variantes.secondaire} ${className}`}>{children}</span>;
}
