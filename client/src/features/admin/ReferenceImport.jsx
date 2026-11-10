import { useState } from 'react';
import { api, download } from '../../api/client.js';
import { Alert, Button, DataTable, Dialog, Input } from '../../components/ui/index.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useI18n } from '../../i18n/index.jsx';

export default function ReferenceImport({ entity, onClose, onDone }) {
  const { t } = useI18n(); const [file, setFile] = useState(null); const [preview, setPreview] = useState(null);
  const action = useAsyncAction({ success: false });
  const send = (commit = false) => action.run(async () => {
    const body = new FormData(); body.append('file', file);
    const result = await api(`/ref/${entity}/import${commit ? '?commit=1' : ''}`, { method: 'POST', body });
    setPreview(result.item); if (commit) await onDone();
  });
  return <Dialog open onClose={onClose} title={t('common.import')} footer={<><Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>
    <Button loading={action.isPending} disabled={!file || preview?.committed} onClick={() => send(Boolean(preview))}>{t(preview ? 'common.confirm' : 'setup.preview')}</Button></>}>
    <div className="space-y-4"><Button variant="secondary" loading={action.isPending} onClick={() => action.run(() => download(`/ref/${entity}/template`, `modele-${entity}.csv`))}>{t('admin.template')}</Button>
      <Input type="file" label={t('common.import')} accept=".csv,text/csv" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); }} />
      {action.error && <Alert variant="danger">{action.error.message}</Alert>}
      {preview && <><Alert variant={preview.summary.error ? 'warning' : 'success'}>{t('refs.importSummary', preview.summary)}{preview.committed && ` · ${t('refs.created', { count: preview.summary.created })}`}</Alert>
        <DataTable columns={[{ key: 'ligne', label: t('admin.line') }, { key: 'message', label: t('common.details') }]} rows={preview.rows.filter((row) => row.statut !== 'ok')} rowKey="ligne" /></>}
    </div>
  </Dialog>;
}
