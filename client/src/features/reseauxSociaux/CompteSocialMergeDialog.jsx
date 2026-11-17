import { useState } from 'react';
import { compteSocialMergeResultSchema } from '@anm/shared';
import { api } from '../../api/client.js';
import { Alert, Button, Dialog, Select, useToast } from '../../components/ui/index.js';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';

export default function CompteSocialMergeDialog({ source, onClose, onChanged }) {
  const { t } = useI18n(); const { push } = useToast();
  const listing = useApiQuery('/reseaux-sociaux?pageSize=200&sort=nom&dir=asc');
  const [targetId, setTargetId] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(null);
  const candidates = (listing.data?.items || []).filter((item) => item.id !== source.id && !item.deleted_at);
  const target = candidates.find((item) => String(item.id) === targetId);
  const submit = async () => {
    if (!target) return;
    setBusy(true); setError(null);
    try {
      const response = await api('/reseaux-sociaux/fusion', { method: 'POST', schema: compteSocialMergeResultSchema, fallback: null,
        body: { sourceId: source.id, cibleId: target.id, expectedSourceVersion: source.version, expectedCibleVersion: target.version } });
      if (!response?.item) throw new Error(t('social.badResponse'));
      await onChanged(); push(t('social.merge.done')); onClose();
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  };
  return <Dialog open title={t('social.merge.title')} onClose={onClose} size="md"
    footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button>
      <Button loading={busy} disabled={!target} onClick={submit}>{t('social.merge.action')}</Button></>}>
    {error && <Alert variant="danger" className="mb-4"><bdi>{error.message || String(error)}</bdi></Alert>}
    <p className="mb-4 text-sm text-muted">{t('social.merge.help')}</p>
    <Alert variant="info">{t('social.merge.immutableHelp')}</Alert>
    <div className="mt-4"><Select label={t('social.merge.target')} value={targetId} placeholder={t('common.all')}
      options={candidates.map((item) => ({ value: item.id, label: item.nom || t('social.missingName') }))}
      onChange={(event) => setTargetId(event.target.value)} />
      {!listing.isLoading && !candidates.length && <p className="mt-2 text-sm text-muted">{t('social.merge.noTarget')}</p>}
    </div>
  </Dialog>;
}
