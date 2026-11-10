import { useMemo, useState } from 'react';
import { Pencil, Plus, Power, Upload } from 'lucide-react';
import { normalize } from '@anm/shared';
import { api } from '../../api/client.js';
import { Button, Card, Combobox, DataTable, Dialog, EmptyState, Input, Pagination, Select, Tabs } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useRefs } from '../../context/RefsContext.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useOptimisticRows } from '../../hooks/useOptimisticRows.js';
import { refLabel, useI18n } from '../../i18n/index.jsx';
import { refOptions } from '../anomalies/helpers.js';
import LimitsAdmin from './LimitsAdmin.jsx';
import ReferenceFields, { emptyReference } from './ReferenceFields.jsx';
import ReferenceImport from './ReferenceImport.jsx';
import { WorkflowSummary } from '../anomalies/InterventionField.jsx';

const entities = ['domaines', 'types', 'dairas', 'communes', 'epics', 'agents', 'limites'];
const labelKeys = { domaines: 'admin.domains', types: 'admin.types', dairas: 'admin.dairas', communes: 'admin.communes', epics: 'admin.epics', agents: 'admin.agents', limites: 'admin.limits' };
export default function ReferencesAdmin() {
  const { t, lang } = useI18n(); const { refs, reload } = useRefs(); const [entity, setEntity] = useState('domaines');
  const [editor, setEditor] = useState(null); const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState(''); const [parent, setParent] = useState(''); const [grade, setGrade] = useState(''); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(25);
  const path = `/ref/${entity}`; const query = useApiQuery(path, { enabled: entity !== 'limites', placeholderData: undefined });
  const toggle = useOptimisticRows(path, reload); const save = useAsyncAction(); const rows = query.data?.items;
  const name = (row) => row.name || row.full_name || refLabel(row, lang);
  const filtered = useMemo(() => (rows ?? []).filter((row) => (!parent || String(row.domaine_id || row.daira_id) === parent)
    && (!grade || row.grade === grade) && normalize([row.name, row.full_name, row.name_ar, row.name_fr, row.grade, row.email, row.matricule].filter(Boolean).join(' ')).includes(normalize(search))), [rows, search, parent, grade]);
  const refresh = async () => { await Promise.all([query.refetch(), reload()]); };
  const openEditor = (row) => setEditor({ ...emptyReference(entity), ...row, ...(entity === 'epics' ? { domaine_ids: refs.epics.find((epic) => epic.id === row?.id)?.domaine_ids ?? [] } : {}) });
  const columns = [
    { key: 'name', label: t('field.name'), render: (row) => <bdi className="font-semibold">{name(row)}</bdi> },
    ...(entity === 'agents' ? [{ key: 'grade', label: t('field.grade'), render: (row) => <bdi>{row.grade || '—'}</bdi> },
      { key: 'email', label: t('field.email'), render: (row) => <bdi>{row.email || '—'}</bdi> }] : []),
    ...(entity === 'epics' ? [{ key: 'workflow', label: t('workflow.title'), render: (row) => <WorkflowSummary workflow={row.workflow} name={row.name} /> }] : []),
    { key: 'actif', label: t('common.active'), render: (row) => t(row.actif ? 'common.yes' : 'common.no') },
    { key: 'actions', label: t('common.actions'), render: (row) => <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => openEditor(row)}><Pencil className="h-4 w-4" />{t('common.edit')}</Button>
      <Button size="sm" variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate({ row, changes: { actif: row.actif ? 0 : 1 } })}><Power className="h-4 w-4" />{t(row.actif ? 'admin.deactivate' : 'admin.activate')}</Button></div> },
  ];
  const submit = (event) => { event.preventDefault(); save.run(async () => {
    const body = { ...editor };
    for (const key of ['domaine_id', 'daira_id', 'zone_daira_id']) if (key in body) body[key] = Number(body[key]) || null;
    for (const key of ['email', 'grade', 'matricule', 'telephone']) if (body[key] === '') body[key] = null;
    await api(`${path}${editor.id ? `/${editor.id}` : ''}`, { method: editor.id ? 'PATCH' : 'POST', body });
    setEditor(null); await refresh();
  }); };
  return <><Tabs ariaLabel={t('admin.references')} tabs={entities.map((value) => ({ value, label: t(labelKeys[value]) }))} value={entity}
    onChange={(value) => { setEntity(value); setSearch(''); setParent(''); setGrade(''); setPage(1); setEditor(null); }} />
    {entity === 'limites' ? <div className="mt-5"><LimitsAdmin /></div> : <>
      <div className="mt-5 flex flex-wrap items-end gap-3"><Input label={t('common.search')} type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        {['types', 'communes'].includes(entity) && <Combobox label={t(entity === 'types' ? 'field.category' : 'field.daira')} value={parent}
          options={refOptions(entity === 'types' ? refs.domaines : refs.dairas, lang)} onChange={(value) => { setParent(value); setPage(1); }} />}
        {entity === 'agents' && <Select label={t('field.grade')} value={grade} placeholder={t('common.all')} options={[...new Set((rows ?? []).map((row) => row.grade).filter(Boolean))].map((value) => ({ value, label: value }))}
          onChange={(event) => { setGrade(event.target.value); setPage(1); }} />}
        <span className="me-auto text-sm text-muted">{t('refs.count', { count: filtered.length })}</span>
        <Button variant="secondary" onClick={() => setImporting(true)}><Upload className="h-4 w-4" />{t('common.import')}</Button><Button onClick={() => openEditor()}><Plus className="h-4 w-4" />{t('common.add')}</Button></div>
      <Card className="mt-5 overflow-hidden"><QueryContent query={query}><DataTable columns={columns} rows={filtered.slice((page - 1) * pageSize, page * pageSize)} empty={<EmptyState title={t('common.noData')} />} />
        <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1); }} /></QueryContent></Card>
      <Dialog open={Boolean(editor)} onClose={() => setEditor(null)} title={`${t(editor?.id ? 'common.edit' : 'common.add')} · ${t(labelKeys[entity])}`} footer={<>
        <Button variant="ghost" onClick={() => setEditor(null)}>{t('common.cancel')}</Button><Button type="submit" form="reference-editor" loading={save.isPending}>{t('common.save')}</Button></>}>
        {editor && <form id="reference-editor" className="space-y-4" onSubmit={submit}><ReferenceFields entity={entity} form={editor} refs={refs} set={(key, value) => setEditor((current) => ({ ...current, [key]: value }))} /></form>}
      </Dialog>
      {importing && <ReferenceImport entity={entity} onClose={() => setImporting(false)} onDone={refresh} />}
    </>}
  </>;
}
