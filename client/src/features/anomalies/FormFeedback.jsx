import { CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Button } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

export function FeedbackLine({ children, warning = false, loading = false }) {
  const Icon = loading ? LoaderCircle : warning ? TriangleAlert : CheckCircle2;
  return <p data-feedback className={`flex min-w-0 items-start gap-2 text-sm ${warning ? 'text-danger' : 'text-ink2'}`}>
    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /><span className="min-w-0 break-words">{children}</span></p>;
}
export default function FormFeedback({ model, field = 'all' }) {
  const { t } = useI18n(); const { state } = model; const { result, feedback, tasks } = state;
  const point = result?.coords?.length === 1 ? result.coords[0] : state.values.gps;
  const link = result?.urls?.find((u) => u.type === 'social' || u.type === 'autre');
  const values = { plateforme: t(`platform.${link?.plateforme || 'autre'}`), contenu: t(`content.${link?.contenuType || 'autre'}`),
    lat: point?.lat?.toFixed(6), lng: point?.lng?.toFixed(6), source: t(`gps.source.${state.meta.gps?.source || 'manuel'}`) };
  const resolving = tasks.resolve.status === 'loading'; const failed = ['warning', 'error'].includes(tasks.resolve.status);
  const short = result?.urls?.find((url) => url.a_resoudre)?.normalise;
  return <div className="mt-2 space-y-2" aria-live="polite">
    {feedback.pending && <FeedbackLine loading>{t('paste.analyzing')}</FeedbackLine>}
    {field === 'all' && feedback.general && <FeedbackLine warning>{t(feedback.general)}</FeedbackLine>}
    {field !== 'gps' && feedback.lien && <FeedbackLine warning={feedback.lien === 'lien.invalide'}>{t(feedback.lien, values)}</FeedbackLine>}
    {field !== 'gps' && feedback.corrected && <FeedbackLine>{t('lien.corrige')}</FeedbackLine>}
    {feedback.redirected && <FeedbackLine>{t(feedback.redirected)}</FeedbackLine>}
    {field !== 'lien' && feedback.gps && !resolving && !failed && <FeedbackLine warning={feedback.gps === 'gps.invalide'}>{t(feedback.gps, values)}</FeedbackLine>}
    {field !== 'lien' && point?.hors_zone && <FeedbackLine warning>{t('gps.horsZone')}</FeedbackLine>}
    {field !== 'lien' && point?.avertissement && <FeedbackLine warning>{t('gps.destination')}</FeedbackLine>}
    {field !== 'lien' && resolving && <FeedbackLine loading>{t('resolve.encours')}</FeedbackLine>}
    {field !== 'lien' && tasks.resolve.status === 'ok' && tasks.resolve.data?.coords && <FeedbackLine>{t('resolve.ok')}</FeedbackLine>}
    {field !== 'lien' && failed && <div className="rounded-md border border-danger bg-surface p-3">
      <FeedbackLine warning>{t(`resolve.${tasks.resolve.message || tasks.resolve.data?.code || 'NETWORK_UNAVAILABLE'}`)}</FeedbackLine>
      <ol className="my-2 list-inside list-decimal text-sm text-ink2"><li>{t('resolve.step1')}</li><li>{t('resolve.step2')}</li><li>{t('resolve.step3')}</li></ol>
      <div className="flex flex-wrap gap-2">{short && <Button as="a" href={short} target="_blank" rel="noopener noreferrer" variant="secondary">{t('resolve.open')}</Button>}
        <Button variant="secondary" onClick={model.paste.retry}>{t('common.retry')}</Button></div>
    </div>}
    {field !== 'lien' && tasks.locate.status === 'loading' && <FeedbackLine loading>{t('locate.loading')}</FeedbackLine>}
    {field !== 'lien' && tasks.locate.data?.item && <FeedbackLine>{t(tasks.locate.data.item.commune_id ? tasks.locate.data.item.confiance === 'haute' ? 'locate.ok' : 'locate.suggestion' : 'locate.aucune')}</FeedbackLine>}
    {field !== 'gps' && tasks.duplicates.status === 'loading' && <FeedbackLine loading>{t('dup.loading')}</FeedbackLine>}
    {field !== 'gps' && model.matches.length > 0 && <FeedbackLine warning>{t('dup.lien')}</FeedbackLine>}
    {field === 'all' && tasks.exif.status !== 'idle' && <FeedbackLine loading={tasks.exif.status === 'loading'}>{t(tasks.exif.status === 'loading' ? 'exif.loading' : tasks.exif.data?.ok ? 'exif.ok' : 'exif.aucune')}</FeedbackLine>}
  </div>;
}
