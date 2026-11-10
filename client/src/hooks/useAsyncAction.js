import { useMutation } from '@tanstack/react-query';
import { useToast } from '../components/ui/index.js';
import { useI18n } from '../i18n/index.jsx';

/** Les actions déclenchées par un bouton exposent immédiatement leur état et leurs erreurs. */
export function useAsyncAction({ success = true } = {}) {
  const { push } = useToast(); const { t } = useI18n();
  const mutation = useMutation({ mutationFn: (operation) => operation(),
    onSuccess: () => { if (success) push(t('common.success')); }, onError: (error) => push(error.message, 'danger') });
  return { ...mutation, run: mutation.mutate };
}
