import { CheckCircle2, Circle, Save, LoaderCircle } from 'lucide-react';
import { validateForm } from '@anm/shared';
import { useI18n } from '../../i18n/index.jsx';
import { focusFormField } from './formFocus.js';

const steps = [
  { name: 'form.source', fields: ['lien_url', 'date_signalement'] },
  { name: 'form.classification', fields: ['domaine_id', 'type_id'] },
  { name: 'form.location', fields: ['daira_id', 'commune_id'] },
];
export default function FormProgress({ model }) {
  const { t } = useI18n(); const { state } = model; const invalid = validateForm(state.values, state.original);
  const complete = steps.flatMap((step) => step.fields).filter((field) => !invalid[field]).length;
  const Icon = state.draftStatus === 'saving' ? LoaderCircle : Save;
  return <section className="mb-5 rounded-lg border border-border bg-surface p-4" aria-label={t('form.progress')}>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{t('form.completion', { count: complete })}</p>
      <p data-draft-status className="flex items-center gap-1.5 text-xs text-muted" aria-live="polite"><Icon className={`h-4 w-4 ${state.draftStatus === 'saving' ? 'animate-spin' : ''}`} aria-hidden="true" />{t(`draft.${state.draftStatus}`)}</p></div>
    <div className="my-3 h-1.5 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-label={t('form.requiredFields')} aria-valuemin={0} aria-valuemax={6} aria-valuenow={complete}>
      <div className="h-full rounded-full bg-brand-700 transition-all duration-200" style={{ width: `${complete / 6 * 100}%` }} />
    </div>
    <nav className="grid grid-cols-3 gap-2" aria-label={t('form.progress')}>{steps.map((step, index) => {
      const missing = step.fields.find((field) => invalid[field]); const StepIcon = missing ? Circle : CheckCircle2;
      return <button key={step.name} type="button" className="flex min-h-11 flex-wrap items-center justify-center gap-1.5 rounded-md border border-border px-1 text-xs font-semibold text-ink transition hover:bg-surface2 sm:text-sm"
        aria-label={t('form.goTo', { section: t(step.name) })} onClick={() => focusFormField(missing || step.fields[0])}>
        <StepIcon className={`h-4 w-4 shrink-0 ${missing ? 'text-muted' : 'text-brand-700'}`} aria-hidden="true" /><span>{index + 1}. {t(step.name)}</span>
      </button>;
    })}</nav>
  </section>;
}
