import { Skeleton } from '../../../components/ui/Feedback.jsx';
import { useI18n } from '../../../i18n/index.jsx';

export default function ListSkeleton() {
  const { t } = useI18n();
  return <div data-list-loading role="status" className="min-h-[420px] space-y-2 p-4">
    <span className="sr-only">{t('common.loading')}</span>
    <Skeleton className="h-10 w-full" />
    {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
  </div>;
}
