export function PageHeader({ title, description, actions, eyebrow }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div className="min-w-0">{eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-700">{eyebrow}</p>}<h1 className="text-2xl font-black tracking-tight text-ink md:text-3xl"><bdi>{title}</bdi></h1>{description && <p className="mt-2 max-w-3xl text-sm text-muted">{description}</p>}</div>{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}</div>;
}
