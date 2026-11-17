import { ArrowUpRight, Database, ExternalLink, MapPin, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { isSafeHttpUrl } from '@anm/shared';
import { Card, CardHeader, DataTable, EmptyState, ErrorState, IconButton, Pagination, PlatformBadge } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { CompteSocialEtat, CompteSocialType, socialLocationLabel } from './CompteSocialBadges.jsx';

export default function ComptesSociauxList({ query, filters, onFilter, onOpen, onEdit, onTrash, onRestore, canManage, title, emptyAction }) {
  const { t, lang } = useI18n();
  const data = query.data || { items: [], total: 0, page: 1, pageSize: 25 };
  const name = (item) => item.nom || t('social.missingName');
  const actions = (item) => <div className="flex items-center gap-1">
    {isSafeHttpUrl(item.lien_url) && <a className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-md text-ink2 hover:bg-surface2" href={item.lien_url}
      target="_blank" rel="noopener noreferrer" aria-label={t('social.openLinkNamed', { nom: name(item) })}><ExternalLink className="h-4 w-4" aria-hidden="true" /></a>}
    {canManage && !item.deleted_at && <IconButton aria-label={t('social.editNamed', { nom: name(item) })} onClick={() => onEdit(item)}><Pencil className="h-4 w-4" aria-hidden="true" /></IconButton>}
    {canManage && (item.deleted_at
      ? <IconButton aria-label={t('social.restoreNamed', { nom: name(item) })} onClick={() => onRestore(item)}><RotateCcw className="h-4 w-4" aria-hidden="true" /></IconButton>
      : <IconButton aria-label={t('social.trashNamed', { nom: name(item) })} onClick={() => onTrash(item)}><Trash2 className="h-4 w-4" aria-hidden="true" /></IconButton>)}
  </div>;
  const columns = [
    { key: 'nom', label: t('social.name'), sortable: true, render: (item) => <button type="button" className="flex min-h-11 max-w-sm items-center gap-2 text-start font-bold text-brand-700 hover:underline"
      aria-label={t('social.openNamed', { nom: name(item) })} onClick={() => onOpen(item.id)}><bdi className="min-w-0 break-words">{name(item)}</bdi><ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" /></button> },
    { key: 'plateforme', label: t('social.network'), sortable: true, render: (item) => <PlatformBadge value={item.plateforme} /> },
    { key: 'categorie', label: t('social.accountType'), sortable: true, render: (item) => <CompteSocialType value={item.categorie} /> },
    { key: 'ca', label: t('social.ca'), sortable: true, render: (item) => <bdi>{socialLocationLabel(item, 'ca', lang)}</bdi> },
    { key: 'commune', label: t('field.commune'), sortable: true, render: (item) => <div className="min-w-32"><bdi>{socialLocationLabel(item, 'commune', lang)}</bdi>
      {!item.commune_id && <span className="mt-1 block text-xs text-muted">{t('social.unlinked')}</span>}</div> },
    { key: 'verification', label: t('social.state'), render: (item) => <CompteSocialEtat item={item} /> },
    { key: 'actions', label: t('common.actions'), render: actions },
  ];
  const sort = (key) => onFilter({ sort: key, dir: filters.sort === key && filters.dir === 'asc' ? 'desc' : 'asc' });
  return <Card className="overflow-hidden" data-social-list>
    <CardHeader title={title || t('social.directory')} description={t('social.listHelp')} />
    <QueryContent query={query}>
      {!query.data ? <ErrorState message={t('social.badResponse')} onRetry={query.refetch} /> : !data.items.length ? <EmptyState icon={Database} title={t('social.empty')} description={t('social.emptyHelp')} action={emptyAction} /> : <>
        <div className="hidden md:block"><DataTable columns={columns} rows={data.items} sort={filters.sort} dir={filters.dir} onSort={sort} /></div>
        <ul className="grid gap-3 p-4 md:hidden">{data.items.map((item) => <li key={item.id} className="min-w-0 rounded-md border border-border p-4">
          <button type="button" className="flex min-h-11 w-full items-start justify-between gap-2 text-start font-bold text-brand-700"
            aria-label={t('social.openNamed', { nom: name(item) })} onClick={() => onOpen(item.id)}><bdi className="break-words">{name(item)}</bdi><ArrowUpRight className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" /></button>
          <div className="mt-2 flex flex-wrap items-center gap-2"><PlatformBadge value={item.plateforme} /><CompteSocialType value={item.categorie} /></div>
          <div className="mt-3 flex items-start gap-2 text-xs text-ink2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><div>
            <bdi>{socialLocationLabel(item, 'commune', lang)}</bdi><span className="mx-1">·</span><bdi>{socialLocationLabel(item, 'ca', lang)}</bdi>
            {!item.commune_id && <span className="mt-1 block text-muted">{t('social.unlinked')}</span>}
          </div></div>
          {item.observations && <p className="mt-3 line-clamp-2 break-words text-xs text-muted"><bdi>{item.observations}</bdi></p>}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><CompteSocialEtat item={item} />{actions(item)}</div>
        </li>)}</ul>
      </>}
      {query.data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total}
        onPage={(page) => onFilter({ page }, false)} onPageSize={(pageSize) => onFilter({ pageSize })} />}
    </QueryContent>
  </Card>;
}
