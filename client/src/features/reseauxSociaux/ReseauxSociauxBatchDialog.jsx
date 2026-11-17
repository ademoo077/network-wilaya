import { useState } from 'react';
import { compteSocialBatchResultSchema, compteSocialCreateSchema, normaliserUrl } from '@anm/shared';
import { api } from '../../api/client.js';
import { Alert, Button, Dialog, Textarea, useToast } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

const TYPES = ['page', 'profil', 'groupe', 'chaine', 'autre'];
export default function ReseauxSociauxBatchDialog({ onClose, onChanged }) {
  const { t } = useI18n(); const { push } = useToast();
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(null); const [result, setResult] = useState(null);
  const parseLines = () => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [lien_url, nom = '', categorie = 'page'] = line.split('|').map((part) => part.trim());
    const detected = normaliserUrl(lien_url);
    return { index: index + 1, value: { nom, lien_url, categorie: TYPES.includes(categorie) ? categorie : 'page',
      plateforme: detected.ok ? detected.plateforme : 'autre', daira_id: null, commune_id: null,
      ca_libelle: '', commune_libelle: '', observations: '', verification: 'a_verifier', actif: 1 } };
  });
  const submit = async () => {
    const lines = parseLines();
    const invalid = lines.filter(({ value }) => !compteSocialCreateSchema.safeParse(value).success);
    if (!lines.length || invalid.length) { setError(t('social.batch.invalidLine', { index: invalid[0]?.index || 0, message: invalid[0]?.value.lien_url || '' })); return; }
    setBusy(true); setError(null);
    try {
      const response = await api('/reseaux-sociaux/lot', { method: 'POST', body: { elements: lines.map(({ value }) => value) }, schema: compteSocialBatchResultSchema, fallback: null });
      if (!response?.item) throw new Error(t('social.badResponse'));
      setResult(response.item); await onChanged(); push(t('social.batch.result', { created: response.item.created, errors: response.item.errors.length }));
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  };
  return <Dialog open title={t('social.batch.title')} onClose={onClose} size="lg"
    footer={result ? <Button onClick={onClose}>{t('social.finish')}</Button> : <>
      <Button variant="secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button>
      <Button loading={busy} disabled={!text.trim()} onClick={submit}>{t('social.batch.start')}</Button></>}>
    {error && <Alert variant="danger" className="mb-4"><bdi>{error.message || String(error)}</bdi></Alert>}
    {result ? <div className="space-y-3 text-sm">
      <p>{t('social.batch.result', { created: result.created, errors: result.errors.length })}</p>
      {result.errors.length > 0 && <div><h4 className="font-bold">{t('social.batch.errors')}</h4>
        <ul className="mt-2 space-y-1">{result.errors.map((item) => <li key={item.index}><bdi>{t('social.batch.invalidLine', { index: item.index + 1, message: item.message })}</bdi></li>)}</ul></div>}
    </div> : <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <p className="mb-4 text-sm text-muted">{t('social.batch.help')}</p>
      <Textarea label={t('social.link')} value={text} rows={10} dir="ltr" placeholder={t('social.batch.placeholder')} onChange={(event) => { setText(event.target.value); setError(null); }} />
    </form>}
  </Dialog>;
}
