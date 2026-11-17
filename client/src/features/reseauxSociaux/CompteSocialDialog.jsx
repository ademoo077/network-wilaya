import { useEffect, useId, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { COMPTE_SOCIAL_TYPES, COMPTE_SOCIAL_VERIFICATIONS, PLATEFORMES, compteSocialCreateSchema, compteSocialItemSchema, compteSocialUpdateSchema, normaliserCompteSocial, normaliserUrl, zodFields } from '@anm/shared';
import { api } from '../../api/client.js';
import { Alert, Button, Checkbox, Dialog, Input, Select, Textarea } from '../../components/ui/index.js';
import { useRefs } from '../../context/RefsContext.jsx';
import { refLabel, useI18n } from '../../i18n/index.jsx';

function initialForm(item) {
  return { nom: item?.nom || '', lien_url: item?.lien_url || '', plateforme: item?.plateforme || 'facebook', categorie: item?.categorie || 'page',
    daira_id: item?.daira_id ? String(item.daira_id) : '', commune_id: item?.commune_id ? String(item.commune_id) : '',
    ca_libelle: item?.ca_libelle || '', commune_libelle: item?.commune_libelle || '', observations: item?.observations || '',
    verification: item?.verification || 'a_verifier', actif: item?.actif ?? 1 };
}
export default function CompteSocialDialog({ item, onClose, onSaved }) {
  const { t, lang } = useI18n(); const { refs } = useRefs(); const formId = useId();
  const [record, setRecord] = useState(item);
  const [form, setForm] = useState(() => initialForm(item));
  const [initial, setInitial] = useState(() => JSON.stringify(initialForm(item)));
  const [fields, setFields] = useState({}); const [error, setError] = useState(null);
  const [conflicted, setConflicted] = useState(false);
  const [busy, setBusy] = useState(false); const [discard, setDiscard] = useState(false);
  const dirty = JSON.stringify(form) !== initial;
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const set = (values) => { setForm((current) => ({ ...current, ...values })); setFields({}); if (!conflicted) setError(null); };
  const close = () => { if (busy) return; if (discard) setDiscard(false); else if (dirty) setDiscard(true); else onClose(); };
  const communes = refs.dairas.find((row) => String(row.id) === form.daira_id)?.communes || [];
  const url = normaliserCompteSocial(form.lien_url);
  const submit = async (event) => {
    event.preventDefault(); if (busy || conflicted) return;
    const values = { ...form, daira_id: form.daira_id ? Number(form.daira_id) : null, commune_id: form.commune_id ? Number(form.commune_id) : null };
    const before = JSON.parse(initial);
    const body = record?.id ? { ...Object.fromEntries(Object.entries(values).filter(([key]) => form[key] !== before[key])), version: record.version } : values;
    const parsed = (record?.id ? compteSocialUpdateSchema : compteSocialCreateSchema).safeParse(body);
    if (!parsed.success) { setFields(zodFields(parsed.error)); return; }
    setBusy(true); setError(null); setFields({});
    try {
      const result = await api(record?.id ? `/reseaux-sociaux/${record.id}` : '/reseaux-sociaux',
        { method: record?.id ? 'PATCH' : 'POST', body: parsed.data, schema: compteSocialItemSchema, fallback: null });
      if (!result?.item) throw new Error(t('social.badResponse'));
      await onSaved(result.item);
    } catch (cause) { setError(cause); setFields(cause.fields || {}); if (cause.code === 'VERSION_CONFLICT') setConflicted(true); }
    finally { setBusy(false); }
  };
  const reload = async () => {
    setBusy(true);
    try {
      const result = await api(`/reseaux-sociaux/${record.id}`);
      if (!result?.item) throw new Error(t('social.badResponse'));
      setRecord(result.item); const values = initialForm(result.item); setForm(values); setInitial(JSON.stringify(values)); setFields({}); setError(null); setConflicted(false);
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  };
  return <Dialog open title={t(record?.id ? 'social.edit' : 'social.add')} onClose={close} size="lg"
    footer={discard ? <><Button variant="secondary" onClick={() => setDiscard(false)}>{t('social.keepEditing')}</Button>
      <Button variant="secondary" onClick={onClose}>{t('social.discard')}</Button></> : <><Button variant="secondary" disabled={busy} onClick={close}>{t('common.cancel')}</Button>
      <Button type="submit" form={formId} loading={busy} disabled={conflicted || (record?.id && !dirty)}><Save className="h-4 w-4" aria-hidden="true" />{t('common.save')}</Button></>}>
    {discard ? <Alert variant="warning" title={t('social.unsaved')}>{t('social.unsavedHelp')}</Alert> : <form id={formId} onSubmit={submit} noValidate>
      <p className="mb-5 text-sm text-muted">{t('social.formHelp')}</p>
      {error && <Alert className="mb-4" variant={conflicted ? 'warning' : 'danger'} title={conflicted ? t('social.conflict') : t('common.error')}>
        <p><bdi>{conflicted ? t('social.conflictHelp') : error.code === 'COMPTE_SOCIAL_EXISTANT' ? t('social.duplicateHelp') : error.message}</bdi></p>
        {error.code === 'COMPTE_SOCIAL_EXISTANT' && error.details?.nom && <p className="mt-2 text-sm font-semibold"><bdi>{error.details.nom}</bdi></p>}
        {conflicted && error.code !== 'VERSION_CONFLICT' && <p className="mt-2"><bdi>{error.message}</bdi></p>}
        {conflicted && <Button className="mt-3" variant="secondary" loading={busy} onClick={reload}><RefreshCw className="h-4 w-4" aria-hidden="true" />{t('social.reloadRecord')}</Button>}
      </Alert>}
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <Input label={t('social.name')} required={!record?.id || Boolean(record.nom)} autoComplete="off" maxLength={200} value={form.nom} error={fields.nom && t('social.nameRequired')}
          onChange={(event) => set({ nom: event.target.value })} hint={t('social.nameHelp')} />
        <Input label={t('social.link')} required type="url" dir="ltr" autoComplete="off" maxLength={2048} value={form.lien_url} error={fields.lien_url && t('social.invalidLink')}
          onChange={(event) => { const lien_url = event.target.value; const detected = normaliserUrl(lien_url); set({ lien_url, ...(detected.ok ? { plateforme: detected.plateforme } : {}) }); }} hint={t('social.linkHelp')} />
        {url.ok && url.publication && <Alert variant="warning">{t('social.warning.lien_publication')}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={t('social.network')} required value={form.plateforme} options={PLATEFORMES.map((value) => ({ value, label: t(`platform.${value}`) }))}
            onChange={(event) => set({ plateforme: event.target.value })} error={fields.plateforme && t('social.networkMismatch')} hint={t('social.networkHelp')} />
          <Select label={t('social.accountType')} required value={form.categorie} options={COMPTE_SOCIAL_TYPES.map((value) => ({ value, label: t(`social.type.${value}`) }))}
            onChange={(event) => set({ categorie: event.target.value })} error={fields.categorie && t('social.invalidField')} />
          <Select label={t('social.ca')} value={form.daira_id} placeholder={t('social.noAttachment')}
            options={refs.dairas.map((row) => ({ value: row.id, label: refLabel(row, lang), disabled: row.actif === 0 && String(row.id) !== form.daira_id }))}
            onChange={(event) => set({ daira_id: event.target.value, commune_id: '', ca_libelle: '', commune_libelle: '' })} error={fields.daira_id && t('social.territoryError')} />
          <Select label={t('field.commune')} value={form.commune_id} placeholder={t('social.noAttachment')} disabled={!form.daira_id}
            options={communes.map((row) => ({ value: row.id, label: refLabel(row, lang), disabled: row.actif === 0 && String(row.id) !== form.commune_id }))}
            onChange={(event) => set({ commune_id: event.target.value, commune_libelle: '' })} error={fields.commune_id && t('social.territoryError')} />
          {!form.daira_id && <Input label={t('social.caText')} value={form.ca_libelle} maxLength={200} onChange={(event) => set({ ca_libelle: event.target.value })} hint={t('social.unlinkedHelp')} />}
          {!form.commune_id && <Input label={t('social.communeText')} value={form.commune_libelle} maxLength={200} onChange={(event) => set({ commune_libelle: event.target.value })} hint={t('social.unlinkedHelp')} />}
          <Select label={t('social.verificationLabel')} value={form.verification} options={COMPTE_SOCIAL_VERIFICATIONS.map((value) => ({ value, label: t(`social.verification.${value}`) }))}
            onChange={(event) => set({ verification: event.target.value })} hint={t('social.verificationHelp')} />
          <div className="self-center"><Checkbox checked={form.actif === 1} onChange={(event) => set({ actif: event.target.checked ? 1 : 0 })}>{t('social.active')}</Checkbox>
            <p className="mt-1 text-xs text-muted">{t('social.activeHelp')}</p></div>
        </div>
        <Textarea label={t('social.observations')} value={form.observations} maxLength={3000} onChange={(event) => set({ observations: event.target.value })}
          error={fields.observations && t('social.invalidField')} hint={t('social.observationsHelp')} />
      </fieldset>
    </form>}
  </Dialog>;
}
