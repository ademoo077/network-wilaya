import { useState } from 'react';
import { CopyPlus, MoreHorizontal, Save, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Dialog, ErrorState, LoadingBlock } from '../../components/ui/index.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { ClassificationSection, NotesSection, ProcessingSection, SourceSection } from './AnomalyFormSections.jsx';
import FormLocation from './FormLocation.jsx';
import SmartPasteZone from './SmartPasteZone.jsx';
import { useAnomalieForm } from './useAnomalieForm.js';
import FormProgress from './FormProgress.jsx';
import FormSuggestions from './FormSuggestions.jsx';
import { historyLabel } from './helpers.js';
import { focusFormField } from './formFocus.js';
import FormActionBar from './FormActionBar.jsx';

export default function AnomalyFormPage() {
  const { id } = useParams(); const { t } = useI18n(); const navigate = useNavigate(); const model = useAnomalieForm(id);
  const { state, errors, setup, user, loading, loadError, missing, ui } = model;
  const [moreOpen, setMoreOpen] = useState(false);
  const saving = state.tasks.submit.status === 'loading';
  const header = <PageHeader title={t(id ? 'form.editTitle' : 'form.newTitle')} description={t(id ? 'form.editHelp' : 'form.newHelp')} />;
  if (loading) return <div className="page-container">{header}<LoadingBlock /></div>;
  if (loadError || missing) return <div className="page-container">{header}<ErrorState message={loadError?.message || t('notFound.title')} onRetry={model.reload} /></div>;
  if (setup?.referentielTerritorialVide) return <div className="page-container">{header}<Alert variant="danger" title={t('form.noTerritory')}
    action={user.role === 'admin' ? <Button onClick={() => navigate('/assistant')}>{t('form.configure')}</Button> : null}>{t(user.role === 'admin' ? 'setup.intro' : 'form.contactAdmin')}</Alert></div>;
  return <div className="page-container form-page">{header}
    <FormProgress model={model} />
    {state.draft && <Alert className="mb-5" title={t('draft.question')}><div className="flex flex-wrap gap-2"><Button onClick={model.resume}>{t('draft.resume')}</Button><Button variant="secondary" onClick={model.restart}>{t('draft.restart')}</Button></div></Alert>}
    {state.duplicateFrom && <Alert className="mb-5" title={t('form.duplicateReady', { reference: state.duplicateFrom.reference })}>{t('form.duplicateHelp')}</Alert>}
    {Object.keys(errors).length > 0 && <div role="alert" className="mb-5 rounded-md border border-danger bg-surface p-4 text-danger"><h2 className="font-bold">{t('form.errorSummary')}</h2>
      <ul className="mt-2 list-inside list-disc">{Object.entries(errors).map(([key, text]) => <li key={key}><a className="inline-flex min-h-11 items-center underline" href={`#${key}`} onClick={(event) => { event.preventDefault(); focusFormField(key); }}>{key === 'form' ? text : `${historyLabel(key, t)} : ${text}`}</a></li>)}</ul>
      {state.tasks.submit.message === 'VERSION_CONFLICT' && <Button variant="secondary" onClick={() => model.reload()}>{t('common.refresh')}</Button>}</div>}
    <form noValidate onSubmit={(event) => { event.preventDefault(); model.save(); }} onBlur={(event) => { if (event.target.id && event.target.id in state.values) model.blur(event.target.id === 'gps_text' ? 'gps' : event.target.id); }}>
      <SmartPasteZone model={model} />
      <FormSuggestions model={model} />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2"><SourceSection model={model} /></div>
        <div className="grid items-start gap-6"><ClassificationSection model={model} /><ProcessingSection model={model} editing={Boolean(id)} /></div>
        <FormLocation model={model} />
        <div className="lg:col-span-2"><NotesSection model={model} /></div>
      </div>
      <FormActionBar>
        <div className="flex items-center gap-2 sm:hidden">
          <Button type="submit" className="flex-1" loading={saving}><Save className="h-4 w-4" aria-hidden="true" />{t('common.save')}</Button>
          <Button variant="secondary" aria-expanded={moreOpen} aria-controls="form-more-actions" onClick={() => setMoreOpen(!moreOpen)}>
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />{t('form.moreActions')}</Button>
        </div>
        {moreOpen && <div id="form-more-actions" className="mt-2 grid gap-2 sm:hidden">
          {!id && <><Button variant="secondary" className="w-full" loading={saving} onClick={() => model.save('new')}>{t('form.saveNew')}</Button>
            <Button variant="secondary" className="w-full" loading={saving} onClick={() => model.save('duplicate')}><CopyPlus className="h-4 w-4" aria-hidden="true" />{t('form.saveDuplicate')}</Button></>}
          {state.tasks.submit.status === 'error' && <Button variant="secondary" className="w-full" onClick={() => model.save(state.saveMode)}>{t('common.retry')}</Button>}
          <Button variant="ghost" className="w-full" onClick={() => navigate(-1)}><X className="h-4 w-4" aria-hidden="true" />{t('common.cancel')}</Button>
        </div>}
        <div className="hidden flex-wrap justify-end gap-2 sm:flex"><Button variant="ghost" onClick={() => navigate(-1)}><X className="h-4 w-4" />{t('common.cancel')}</Button>
          <Button type="submit" loading={saving}><Save className="h-4 w-4" />{t('common.save')}</Button>
          {!id && <><Button variant="secondary" loading={saving} onClick={() => model.save('new')}>{t('form.saveNew')}</Button>
            <Button variant="secondary" loading={saving} onClick={() => model.save('duplicate')}><CopyPlus className="h-4 w-4" />{t('form.saveDuplicate')}</Button></>}
          {state.tasks.submit.status === 'error' && <Button variant="secondary" onClick={() => model.save(state.saveMode)}>{t('common.retry')}</Button>}</div>
        <p className="mt-2 hidden break-words text-center text-xs leading-5 text-muted sm:block sm:text-end" title={t('form.shortcuts')}>{t('form.shortcuts')}</p></FormActionBar>
    </form>
    <Dialog open={state.duplicateDialog} onClose={() => ui({ duplicateDialog: false })} title={t('form.duplicateTitle')} footer={<>
      <Button variant="secondary" onClick={() => ui({ duplicateDialog: false })}>{t('common.cancel')}</Button><Button onClick={() => { ui({ duplicateDialog: false }); model.save(state.saveMode, true); }}>{t('gps.different')}</Button></>}>
      <p>{t('form.duplicateQuestion')}</p><ul>{(state.duplicateMatches || []).map((item) => <li key={item.id}><a className="inline-flex min-h-11 items-center text-brand-700 underline" href={`#/anomalies/${item.id}`}>{t('common.view')} · {item.reference}</a></li>)}</ul>
    </Dialog>
  </div>;
}
